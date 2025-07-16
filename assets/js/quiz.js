import { getCurrentUser, saveUser, createDefaultUser } from './auth.js';

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const questionText = document.getElementById('question-text');
    const answerButtons = document.getElementById('answer-buttons');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const resultsModal = document.getElementById('results-modal');
    const timerElement = document.getElementById('timer');
    const focusBtn = document.getElementById('focus-token-btn');
    const focusCount = document.getElementById('focus-token-count');
    
    let questionPool = [];
    let gameQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let timer;
    let timerInterval;
    let isTimerPaused = false;
    let jackpotIndex = -1;
    let isFirstCompletion = false;
    const QUESTIONS_PER_GAME = 10;
    const TIME_PER_QUESTION = 15;

    createDefaultUser();
    let user = getCurrentUser();

    const urlParams = new URLSearchParams(window.location.search);
    const grade = urlParams.get('grade');
    const subject = urlParams.get('subject');
    const topic = urlParams.get('topic');

    if (!grade || !subject || !topic) {
        questionText.innerText = "Erreur: Information de défi manquante (classe, sujet ou thème).";
        return;
    }
    
    isFirstCompletion = !user.completedQuizzes.includes(`${grade}-${subject}-${topic}`);

    focusCount.innerText = user.focusTokens;
    focusBtn.disabled = user.focusTokens <= 0;
    focusBtn.addEventListener('click', useFocusToken);

    async function fetchQuestions() {
        try {
            const subjectManifestRes = await fetch(`assets/data/grade_${grade}/subjects.json`);
            if (!subjectManifestRes.ok) throw new Error('Manifest for grade not found');
            const subjectManifest = await subjectManifestRes.json();

            if (topic === 'random') {
                const topicsToFetch = Object.keys(subjectManifest[subject].topics);
                const promises = topicsToFetch.map(topicId => 
                    fetch(`assets/data/grade_${grade}/${subject}/${topicId}.json`).then(res => res.json())
                );
                const allTopicQuestions = await Promise.all(promises);
                questionPool = [].concat(...allTopicQuestions);
            } else {
                const filePath = `assets/data/grade_${grade}/${subject}/${topic}.json`;
                questionPool = await fetch(filePath).then(res => res.json());
            }
            startQuiz();
        } catch (error) {
            console.error("Could not load quiz data:", error);
            questionText.innerText = "Erreur: Impossible de charger le défi pour ce thème.";
        }
    }

    fetchQuestions();

    function startQuiz() {
        shuffleArray(questionPool);
        const desiredQuestionCount = Math.min(QUESTIONS_PER_GAME, questionPool.length);
        gameQuestions = questionPool.slice(0, desiredQuestionCount);
        
        if (gameQuestions.length === 0) {
            questionText.innerText = "Pas assez de questions dans ce thème pour commencer un défi.";
            return;
        }
        
        currentQuestionIndex = 0;
        score = 0;
        user.currentStreak = 0;
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
                timerElement.innerText = '∞';
            }

            const question = gameQuestions[currentQuestionIndex];
            questionText.innerText = question.question;

            if (currentQuestionIndex === jackpotIndex) {
                questionText.innerHTML = `🌟 Question Jackpot! 🌟<br>${question.question}`;
            }
            
            question.options.forEach((option, index) => {
                const button = document.createElement('button');
                button.innerText = option;
                button.classList.add('btn-answer');
                button.dataset.answerIndex = index;
                button.addEventListener('click', selectAnswer);
                answerButtons.appendChild(button);
            });
        } else {
            endQuiz();
        }
    }

    function startTimer() {
        const timeForQuestion = gameQuestions[currentQuestionIndex].time || TIME_PER_QUESTION;
        timer = timeForQuestion;
        timerElement.innerText = timer;
        timerInterval = setInterval(() => {
            timer--;
            timerElement.innerText = timer;
            if (timer < 0) {
                clearInterval(timerInterval);
                selectAnswer(null, true);
            }
        }, 1000);
    }

    function useFocusToken() {
        user = getCurrentUser();
        if (user.focusTokens > 0) {
            user.focusTokens--;
            saveUser(user);
            focusCount.innerText = user.focusTokens;
            isTimerPaused = true;
            clearInterval(timerInterval);
            timerElement.innerText = '∞';
            focusBtn.disabled = true;
        }
    }

    function resetState() {
        clearInterval(timerInterval);
        isTimerPaused = false;
        user = getCurrentUser();
        focusBtn.disabled = user.focusTokens <= 0;
        focusCount.innerText = user.focusTokens;
        while (answerButtons.firstChild) {
            answerButtons.removeChild(answerButtons.firstChild);
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

        user = getCurrentUser();
        if (correct) {
            score++;
            user.currentStreak++;
            selectedButton.classList.add('correct');
            user.xp += (10 + timeBonus); 
            
            if (currentQuestionIndex === jackpotIndex) {
                user.xp += 50;
            }

            if (user.currentStreak > 0 && user.currentStreak % 3 === 0) {
                user.xp += (user.currentStreak * 5);
            }
        } else {
            user.currentStreak = 0;
            if (selectedButton) selectedButton.classList.add('incorrect');
        }
        
        Array.from(answerButtons.children).forEach(button => {
            if (parseInt(button.dataset.answerIndex) === gameQuestions[currentQuestionIndex].answer) {
                button.classList.add('correct');
            }
            button.disabled = true;
        });
        
        saveUser(user);

        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 2000);
    }
    
    function updateProgress() {
        const questionNumber = currentQuestionIndex + 1;
        progressText.innerText = `Question ${questionNumber} / ${gameQuestions.length}`;
        const progressPercentage = (questionNumber / gameQuestions.length) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }
    
    function endQuiz() {
        user = getCurrentUser();
        
        let orbsEarned = 0;
        const performance = score / gameQuestions.length;

        if (performance >= 0.7) {
            orbsEarned = Math.floor(performance * 20);
        }

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
        saveUser(user);

        document.getElementById('results-score').innerText = `Votre score : ${score} / ${gameQuestions.length}`;
        document.getElementById('results-xp').innerText = `Vous êtes maintenant au niveau ${user.level}!`;
        document.getElementById('results-orbs').innerText = `Orbs gagnés : +${orbsEarned} 🪙`;
        
        let feedback = "Bon effort ! Continue comme ça.";
        if (performance >= 0.8) {
            feedback = "Excellent travail !";
        } else if (performance < 0.5) {
            feedback = "Tu peux faire mieux, ne lâche rien !";
        }
        document.getElementById('results-feedback').innerText = feedback;
        
        resultsModal.classList.remove('hidden');
    }
});