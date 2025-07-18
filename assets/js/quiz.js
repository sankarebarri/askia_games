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
    const resultsModal = document.getElementById('results-modal');
    const gameHeader = document.querySelector('.game-header');
    const focusBtn = document.getElementById('focus-token-btn');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const timerElement = document.getElementById('timer');
    
    // --- State Variables ---
    let isGuestMode = false;
    let questionPool = [];
    let gameQuestions = [];
    let currentQuestionIndex = 0;
    let score = 0;

    // --- Initial Setup ---
    initializeDatabase();
    let user = getCurrentUser();

    const urlParams = new URLSearchParams(window.location.search);
    const grade = urlParams.get('grade');
    const subject = urlParams.get('subject');
    const topic = urlParams.get('topic');
    const mode = urlParams.get('mode');

    if (mode === 'guest') {
        isGuestMode = true;
        if (gameHeader) gameHeader.style.display = 'none';
        if (focusBtn) focusBtn.style.display = 'none';
    } else if (!user) {
        window.location.href = 'login.html';
        return;
    }

    async function fetchAndStart() {
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
            } else {
                questionPool = await fetch(`assets/data/grade_${grade}/${subject}/${topic}.json`).then(res => res.json());
            }
            startQuiz();
        } catch (error) {
            questionText.innerText = "Erreur: Impossible de charger les questions.";
        }
    }

    fetchAndStart();

    function startQuiz() {
        shuffleArray(questionPool);
        const desiredQuestionCount = Math.min(isGuestMode ? 5 : 10, questionPool.length);
        gameQuestions = questionPool.slice(0, desiredQuestionCount);
        
        if (gameQuestions.length === 0) {
            questionText.innerText = "Pas assez de questions pour commencer.";
            return;
        }
        
        currentQuestionIndex = 0;
        score = 0;
        showNextQuestion();
    }

    function showNextQuestion() {
        if (currentQuestionIndex >= gameQuestions.length) {
            endQuiz();
            return;
        }
        
        while (answerButtons.firstChild) {
            answerButtons.removeChild(answerButtons.firstChild);
        }
        
        const question = gameQuestions[currentQuestionIndex];
        questionText.innerText = question.question;
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.innerText = option;
            button.classList.add('btn-answer');
            button.dataset.answerIndex = index;
            button.addEventListener('click', selectAnswer);
            answerButtons.appendChild(button);
        });

        updateProgress();
    }

    function selectAnswer(e) {
        const selectedButton = e.target;
        const correct = parseInt(selectedButton.dataset.answerIndex) === gameQuestions[currentQuestionIndex].answer;

        if (correct) {
            score++;
            selectedButton.classList.add('correct');
        } else {
            selectedButton.classList.add('incorrect');
        }

        Array.from(answerButtons.children).forEach(button => {
            if (parseInt(button.dataset.answerIndex) === gameQuestions[currentQuestionIndex].answer) {
                button.classList.add('correct');
            }
            button.disabled = true;
        });

        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 1500);
    }

    function updateProgress() {
        const questionNumber = currentQuestionIndex + 1;
        progressText.innerText = `Question ${questionNumber} / ${gameQuestions.length}`;
        const progressPercentage = (questionNumber / gameQuestions.length) * 100;
        progressBar.style.width = `${progressPercentage}%`;
    }

    function endQuiz() {
        let xpEarned = score * 10;
        let orbsEarned = 0;
        const performance = score / gameQuestions.length;
        if (performance >= 0.7) {
            orbsEarned = Math.floor(performance * 20);
        }

        if (isGuestMode) {
            const guestResultsHTML = `
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
            resultsModal.innerHTML = guestResultsHTML;
        } else {
            user.xp += xpEarned;
            user.orbs += orbsEarned;
            if (user.xp >= user.xpToNextLevel) {
                user.level++;
                user.xp -= user.xpToNextLevel;
                user.xpToNextLevel = Math.floor(user.xpToNextLevel * 1.5);
            }
            saveCurrentUser(user);

            const userResultsHTML = `
                <div class="modal-content">
                    <h2>Défi Terminé !</h2>
                    <p>Votre score : ${score} / ${gameQuestions.length}</p>
                    <div class="rewards">
                        <p>XP gagnés : +${xpEarned}</p>
                        <p>Orbs gagnés : +${orbsEarned} 🪙</p>
                    </div>
                    <a href="dashboard.html" class="button primary">Retour au tableau de bord</a>
                </div>
            `;
            resultsModal.innerHTML = userResultsHTML;
        }
        
        resultsModal.classList.remove('hidden');
    }
});
