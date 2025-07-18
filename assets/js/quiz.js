import { getCurrentUser, saveCurrentUser, initializeDatabase } from './auth.js';

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Selections ---
    const questionText = document.getElementById('question-text');
    const answerButtons = document.getElementById('answer-buttons');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const timerElement = document.getElementById('timer');
    const focusBtn = document.getElementById('focus-token-btn');
    const focusCount = document.getElementById('focus-token-count');
    const resultsModal = document.getElementById('results-modal');
    const pauseModal = document.getElementById('pause-modal');
    const pauseBtn = document.getElementById('pause-btn');
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');
    const quitBtn = document.getElementById('quit-btn');
    const quitHomeBtn = document.getElementById('quit-game-home-btn');
    
    // --- State Variables ---
    let questionPool = [];
    let gameQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let timer;
    let timerInterval;
    let isTimerPaused = false;
    let isGamePaused = false;
    let isGuestMode = false;
    let jackpotIndex = -1;
    let isFirstCompletion = false;
    const QUESTIONS_PER_GAME = 10;
    const GUEST_QUESTIONS_PER_GAME = 5; // A shorter quiz for guests
    const TIME_PER_QUESTION = 15;

    // --- Initial Setup ---
    initializeDatabase();
    let user = getCurrentUser();

    const urlParams = new URLSearchParams(window.location.search);
    const grade = urlParams.get('grade');
    const subject = urlParams.get('subject');
    const topic = urlParams.get('topic');
    const mode = urlParams.get('mode');

    if (!grade || !subject || !topic || !mode) {
        if(questionText) questionText.innerText = "Erreur: Information de défi manquante.";
        return;
    }

    // CORRECTED: Properly handle guest mode vs. other modes
    if (mode === 'guest') {
        isGuestMode = true;
        const gameHeader = document.querySelector('.game-header');
        const focusTokenCrystal = document.querySelector('.focus-token-crystal');
        if(gameHeader) gameHeader.style.display = 'none';
        if(focusTokenCrystal) focusTokenCrystal.style.display = 'none';
    } else if (mode === 'multiple_choice') {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        isFirstCompletion = !user.completedQuizzes.includes(`${grade}-${subject}-${topic}`);
        if (focusCount && focusBtn) {
            focusCount.innerText = user.focusTokens;
            if (user.focusTokens <= 0) {
                focusBtn.classList.add('depleted');
            }
            focusBtn.addEventListener('click', useFocusToken);
        }
    } else {
        if(questionText) questionText.innerText = `Le mode de jeu "${mode}" est en cours de construction.`;
        const gameHeader = document.querySelector('.game-header');
        const quizProgressHeader = document.querySelector('.quiz-progress-header');
        if(gameHeader) gameHeader.style.display = 'none';
        if(quizProgressHeader) quizProgressHeader.style.display = 'none';
        return;
    }
    
    // --- Event Listeners ---
    if (pauseBtn) pauseBtn.addEventListener('click', pauseGame);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (restartBtn) restartBtn.addEventListener('click', () => {
        if (confirm("Êtes-vous sûr? Votre progression pour ce défi sera perdue.")) {
            window.location.reload();
        }
    });
    if (quitBtn) quitBtn.addEventListener('click', () => {
        if (confirm("Êtes-vous sûr de vouloir quitter? Votre progression sera perdue.")) {
            window.location.href = 'dashboard.html';
        }
    });
    if (quitHomeBtn) quitHomeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm("Êtes-vous sûr de vouloir quitter? Votre progression sera perdue.")) {
            window.location.href = 'dashboard.html';
        }
    });

    // --- Core Game Logic ---
    async function fetchQuestions() {
        try {
            if (topic === 'random') {
                const subjectManifestRes = await fetch(`assets/data/grade_${grade}/subjects.json`);
                const subjectManifest = await subjectManifestRes.json();
                const topicsToFetch = Object.keys(subjectManifest[subject].topics);
                const promises = topicsToFetch.map(topicId => 
                    fetch(`assets/data/grade_${grade}/${subject}/${topicId}.json`).then(res => res.json())
                );
                const allTopicQuestions = await Promise.all(promises);
                questionPool = [].concat(...allTopicQuestions);
            } else if (topic === 'default') {
                const filePath = `assets/data/grade_${grade}/${subject}.json`;
                questionPool = await fetch(filePath).then(res => res.json());
            } else {
                const filePath = `assets/data/grade_${grade}/${subject}/${topic}.json`;
                questionPool = await fetch(filePath).then(res => res.json());
            }
            startQuiz();
        } catch (error) {
            console.error("Could not load quiz data:", error);
            if(questionText) questionText.innerText = "Erreur: Impossible de charger les questions pour ce thème.";
        }
    }

    fetchQuestions();

    function startQuiz() {
        shuffleArray(questionPool);
        const desiredQuestionCount = isGuestMode ? GUEST_QUESTIONS_PER_GAME : QUESTIONS_PER_GAME;
        gameQuestions = questionPool.slice(0, Math.min(desiredQuestionCount, questionPool.length));
        
        if (gameQuestions.length === 0) {
            if(questionText) questionText.innerText = "Pas assez de questions dans ce thème pour commencer.";
            return;
        }
        
        currentQuestionIndex = 0;
        score = 0;
        if(user) user.currentStreak = 0;
        jackpotIndex = Math.floor(Math.random() * gameQuestions.length);
        showNextQuestion();
    }

    function showNextQuestion() {
        resetState();
        if (currentQuestionIndex < gameQuestions.length) {
            updateProgress();
            
            if (!isTimerPaused) {
                startTimer();
            } else {
                if(timerElement) timerElement.innerText = '∞';
            }

            const question = gameQuestions[currentQuestionIndex];
            if(questionText) questionText.innerText = question.question;

            if (!isGuestMode && currentQuestionIndex === jackpotIndex) {
                if(questionText) questionText.innerHTML = `🌟 Question Jackpot! 🌟<br>${question.question}`;
            }
            
            if(answerButtons) {
                question.options.forEach((option, index) => {
                    const button = document.createElement('button');
                    button.innerText = option;
                    button.classList.add('btn-answer');
                    button.dataset.answerIndex = index;
                    button.addEventListener('click', selectAnswer);
                    answerButtons.appendChild(button);
                });
            }
        } else {
            endQuiz();
        }
    }
    
    function startTimer() {
        const timeForQuestion = gameQuestions[currentQuestionIndex]?.time || TIME_PER_QUESTION;
        timer = timeForQuestion;
        if(timerElement) timerElement.innerText = timer;
        timerInterval = setInterval(() => {
            timer--;
            if(timerElement) timerElement.innerText = timer;
            // CORRECTED: Timer now stops at 0
            if (timer <= 0) {
                clearInterval(timerInterval);
                selectAnswer(null, true);
            }
        }, 1000);
    }

    function useFocusToken() {
        user = getCurrentUser();
        if (user.focusTokens > 0 && !focusBtn.classList.contains('used-this-turn')) {
            user.focusTokens--;
            saveCurrentUser(user);
            if(focusCount) focusCount.innerText = user.focusTokens;
            isTimerPaused = true;
            clearInterval(timerInterval);
            if(timerElement) timerElement.innerText = '∞';
            focusBtn.classList.add('used-this-turn');
            if (user.focusTokens <= 0) {
                focusBtn.classList.add('depleted');
            }
        }
    }

    function resetState() {
        clearInterval(timerInterval);
        isTimerPaused = false;
        user = getCurrentUser();
        if (focusCount && focusBtn) {
            focusBtn.classList.remove('used-this-turn');
            if (user && user.focusTokens > 0) {
                focusBtn.classList.remove('depleted');
            }
            if (user) focusCount.innerText = user.focusTokens;
        }
        if(answerButtons) {
            while (answerButtons.firstChild) {
                answerButtons.removeChild(answerButtons.firstChild);
            }
        }
    }

    function selectAnswer(e, isTimeout = false) {
        clearInterval(timerInterval);
        
        let correct;
        let selectedButton;
        const timeBonus = isTimerPaused ? 5 : (timer < 0 ? 0 : timer);

        if (isTimeout) {
            correct = false;
        } else {
            selectedButton = e.target;
            correct = parseInt(selectedButton.dataset.answerIndex) === gameQuestions[currentQuestionIndex].answer;
        }

        if (correct) {
            score++;
            if(selectedButton) selectedButton.classList.add('correct');
        } else {
            if (selectedButton) selectedButton.classList.add('incorrect');
        }
        
        if (!isGuestMode) {
            user = getCurrentUser();
            if (correct) {
                user.currentStreak++;
                user.xp += (10 + timeBonus); 
                if (currentQuestionIndex === jackpotIndex) user.xp += 50;
                if (user.currentStreak > 0 && user.currentStreak % 3 === 0) user.xp += (user.currentStreak * 5);
            } else {
                user.currentStreak = 0;
            }
            saveCurrentUser(user);
        }
        
        if(answerButtons) {
            Array.from(answerButtons.children).forEach(button => {
                if (parseInt(button.dataset.answerIndex) === gameQuestions[currentQuestionIndex].answer) {
                    button.classList.add('correct');
                }
                button.disabled = true;
            });
        }

        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 2000);
    }
    
    function updateProgress() {
        const questionNumber = currentQuestionIndex + 1;
        if(progressText) progressText.innerText = `Question ${questionNumber} / ${gameQuestions.length}`;
        const progressPercentage = (questionNumber / gameQuestions.length) * 100;
        if(progressBar) progressBar.style.width = `${progressPercentage}%`;
    }
    
    function endQuiz() {
        let xpEarned = score * 10;
        let orbsEarned = 0;
        const performance = score / gameQuestions.length;

        if (performance >= 0.7) {
            orbsEarned = Math.floor(performance * 20);
        }

        if (isGuestMode) {
            resultsModal.innerHTML = `
                <div class="modal-content">
                    <h2>Défi Terminé !</h2>
                    <p>Votre score : ${score} / ${gameQuestions.length}</p>
                    <div class="rewards">
                        <p>Vous avez gagné :</p>
                        <p><strong>${xpEarned} XP</strong> et <strong>${orbsEarned} 🪙 Orbs</strong></p>
                    </div>
                    <a href="register.html?guestScore=${xpEarned}&guestOrbs=${orbsEarned}" class="button primary">
                        Créez un compte pour sauvegarder vos points!
                    </a>
                    <div class="guest-modal-footer">
                        <span>Déjà un compte?</span>
                        <a href="login.html" class="button secondary">Connectez-vous</a>
                    </div>
                </div>
            `;
        } else {
            user = getCurrentUser();
            if (isFirstCompletion) {
                orbsEarned += 50;
                user.completedQuizzes.push(`${grade}-${subject}-${topic}`);
            }
            user.orbs += orbsEarned;
            if (user.xp >= user.xpToNextLevel) {
                user.level++;
                user.xp -= user.xpToNextLevel;
                user.xpToNextLevel = Math.floor(user.xpToNextLevel * 1.5);
            }
            saveCurrentUser(user);
            resultsModal.innerHTML = `
                <div class="modal-content">
                    <h2>Défi Terminé !</h2>
                    <p>Votre score : ${score} / ${gameQuestions.length}</p>
                    <div class="rewards">
                        <p>Vous êtes maintenant au niveau ${user.level}!</p>
                        <p>Orbs gagnés : +${orbsEarned} 🪙</p>
                    </div>
                    <a href="dashboard.html" class="button primary">Retour au tableau de bord</a>
                </div>
            `;
        }
        
        if(resultsModal) resultsModal.classList.remove('hidden');
    }

    function pauseGame() {
        if (isGamePaused) return;
        isGamePaused = true;
        clearInterval(timerInterval);
        if(pauseModal) pauseModal.classList.remove('hidden');
    }

    function resumeGame() {
        if (!isGamePaused) return;
        isGamePaused = false;
        if (!isTimerPaused) {
            startTimer();
        }
        if(pauseModal) pauseModal.classList.add('hidden');
    }
});
