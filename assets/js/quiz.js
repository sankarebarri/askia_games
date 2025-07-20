import { getCurrentUser, saveCurrentUser, initializeDatabase } from './auth.js';
import { getLeagueData, recordPlayerScore } from './league.js';

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
    const prideBanner = document.getElementById('pride-banner');
    const bannerSchoolName = document.getElementById('banner-school-name');
    
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
    let isLeagueMode = false;
    let currentWeekId = null;
    let jackpotIndex = -1;
    let isFirstCompletion = false;
    const QUESTIONS_PER_GAME = 10;
    const GUEST_QUESTIONS_PER_GAME = 5;
    const TIME_PER_QUESTION = 15;

    // --- Initial Setup ---
    initializeDatabase();
    let user = getCurrentUser();

    const urlParams = new URLSearchParams(window.location.search);
    const grade = urlParams.get('grade');
    const subject = urlParams.get('subject');
    const topic = urlParams.get('topic');
    const mode = urlParams.get('mode');

    // --- Mode Handling Logic ---
    if (!mode) {
        if(questionText) questionText.innerText = "Erreur: Mode de jeu non spécifié.";
        return;
    }

    if (mode === 'league') {
        isLeagueMode = true;
        let weekParam = urlParams.get('week');
        currentWeekId = weekParam.startsWith('week_') ? weekParam : `week_${weekParam}`;
        if (!currentWeekId) {
            if(questionText) questionText.innerText = "Erreur: Semaine de compétition non spécifiée.";
            return;
        }
        if (!user) { window.location.href = 'login.html'; return; }
        if (user.leagueParticipation[currentWeekId]) {
            if(questionText) questionText.innerText = "Vous avez déjà participé au défi de cette semaine.";
            document.querySelector('.quiz-progress-header').style.display = 'none';
            if(pauseBtn) pauseBtn.style.display = 'none';
            return;
        }
        if(prideBanner) prideBanner.classList.remove('hidden');
        if(bannerSchoolName) bannerSchoolName.innerText = user.school;
    } else { // Handles 'guest' and 'multiple_choice'
        if (!grade || !subject || !topic) {
            if(questionText) questionText.innerText = "Erreur: Information de défi manquante (classe, sujet, ou thème).";
            return;
        }
        if (mode === 'guest') {
            isGuestMode = true;
            const gameHeader = document.querySelector('.game-header');
            const focusTokenCrystal = document.querySelector('.focus-token-crystal');
            if(gameHeader) gameHeader.style.display = 'none';
            if(focusTokenCrystal) focusTokenCrystal.style.display = 'none';
        } else if (mode === 'multiple_choice' || mode === 'texte_a_trou' || mode === 'image_identify' || mode === 'sentence_builder') {
            if (!user) { window.location.href = 'login.html'; return; }
            // Ensure completedQuizzes exists, initialize if missing
            if (!user.completedQuizzes) {
                user.completedQuizzes = [];
                saveCurrentUser(user);
            }
            isFirstCompletion = !user.completedQuizzes.includes(`${grade}-${subject}-${topic}`);
            if (focusCount && focusBtn) {
                focusCount.innerText = user.focusTokens;
                if (user.focusTokens <= 0) focusBtn.classList.add('depleted');
            }
        } else {
            if(questionText) questionText.innerText = `Le mode de jeu "${mode}" est en cours de construction.`;
            return;
        }
    }
    
    // --- Event Listeners ---
    if (focusBtn && !isGuestMode) focusBtn.addEventListener('click', useFocusToken);
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
        let filePath;
        try {
            if (isLeagueMode) {
                filePath = `assets/data/league_quizzes/${currentWeekId}/grade_${user.defaultGrade}.json`;
            } else {
                if (topic === 'random') {
                    const subjectManifestRes = await fetch(`assets/data/grade_${grade}/subjects.json`);
                    if (!subjectManifestRes.ok) throw new Error(`Could not find subjects.json for grade ${grade}`);
                    const subjectManifest = await subjectManifestRes.json();
                    
                    // --- THE FIX ---
                    const subjectData = subjectManifest[subject];
                    if (!subjectData || !subjectData.topics) {
                        throw new Error(`Subject '${subject}' or its topics not found in manifest for grade ${grade}.`);
                    }
                    // --- END FIX ---

                    const topicsToFetch = Object.keys(subjectData.topics);
                    const promises = topicsToFetch.map(topicId => 
                        fetch(`assets/data/grade_${grade}/${subject}/${topicId}.json`).then(res => res.json())
                    );
                    const allTopicQuestions = await Promise.all(promises);
                    questionPool = [].concat(...allTopicQuestions);
                    startQuiz();
                    return;
                } else if (topic === 'default') {
                    filePath = `assets/data/grade_${grade}/${subject}.json`;
                } else {
                    if (mode === 'image_identify') {
                        filePath = `assets/data/grade_${grade}/${subject}/image_identify.json`;
                    } else if (mode === 'sentence_builder') {
                        filePath = `assets/data/grade_${grade}/${subject}/sentence_builder.json`;
                    } else {
                        filePath = `assets/data/grade_${grade}/${subject}/${topic}.json`;
                    }
                }
            }
            questionPool = await fetch(filePath).then(res => res.json());
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
        if(user && !isGuestMode) user.currentStreak = 0;
        jackpotIndex = (isGuestMode || isLeagueMode) ? -1 : Math.floor(Math.random() * gameQuestions.length);
        showNextQuestion();
    }

    function showNextQuestion() {
        resetState();
        if (currentQuestionIndex < gameQuestions.length) {
            updateProgress();
            if (!isTimerPaused) startTimer();
            else if(timerElement) timerElement.innerText = '∞';

            const question = gameQuestions[currentQuestionIndex];
            // Texte à trou (fill-in-the-blank) support
            if (question.type === 'texte_a_trou') {
                if (questionText) questionText.innerText = question.question;
                if (answerButtons) {
                    answerButtons.innerHTML = '';
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'fill-blank-input';
                    input.placeholder = 'Votre réponse';
                    input.autocomplete = 'off';
                    input.style.marginRight = '10px';
                    input.style.fontSize = '1.1em';
                    input.style.padding = '8px';
                    input.style.width = '60%';
                    const submitBtn = document.createElement('button');
                    submitBtn.innerText = 'Valider';
                    submitBtn.className = 'button primary';
                    submitBtn.style.fontSize = '1.1em';
                    submitBtn.style.padding = '8px 18px';
                    submitBtn.addEventListener('click', () => {
                        handleTexteATrouSubmit(input, question);
                    });
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') submitBtn.click();
                    });
                    answerButtons.appendChild(input);
                    answerButtons.appendChild(submitBtn);
                    input.focus();
                }
                return;
            }

            // Image Identify support
            if (question.type === 'image_identify') {
                if (questionText) questionText.innerText = question.question;
                if (answerButtons) {
                    answerButtons.innerHTML = '';
                    const imgGrid = document.createElement('div');
                    imgGrid.className = 'image-identify-grid';
                    question.images.forEach((imgObj, idx) => {
                        const imgWrap = document.createElement('div');
                        imgWrap.className = 'image-identify-option';
                        const img = document.createElement('img');
                        img.src = `assets/images/${imgObj.src}`;
                        img.alt = imgObj.label;
                        const label = document.createElement('div');
                        label.className = 'label';
                        label.innerText = imgObj.label;
                        imgWrap.appendChild(img);
                        imgWrap.appendChild(label);
                        imgWrap.addEventListener('click', () => {
                            handleImageIdentifySelect(imgWrap, imgObj, question, imgGrid);
                        });
                        imgGrid.appendChild(imgWrap);
                    });
                    answerButtons.appendChild(imgGrid);
                }
                return;
            }

            // Sentence Builder support
            if (question.type === 'sentence_builder') {
                if (questionText) questionText.innerText = question.question;
                if (answerButtons) {
                    answerButtons.innerHTML = '';
                    // Shuffle the words for display
                    const shuffled = [...question.words];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    const pool = document.createElement('div');
                    pool.className = 'sentence-builder-pool';
                    let build = [];
                    const buildArea = document.createElement('div');
                    buildArea.className = 'sentence-builder-build';
                    // Add word buttons
                    shuffled.forEach((word, idx) => {
                        const btn = document.createElement('button');
                        btn.innerText = word;
                        btn.className = 'sentence-builder-word';
                        btn.style.cursor = 'pointer';
                        btn.addEventListener('click', () => {
                            btn.classList.add('selected');
                            btn.disabled = true;
                            build.push(word);
                            updateBuildArea();
                        });
                        pool.appendChild(btn);
                    });
                    // Remove word from build area
                    function updateBuildArea() {
                        buildArea.innerHTML = '';
                        build.forEach((word, idx) => {
                            const wbtn = document.createElement('button');
                            wbtn.innerText = word;
                            wbtn.className = 'sentence-builder-word selected';
                            wbtn.addEventListener('click', () => {
                                // Remove from build, re-enable in pool
                                build.splice(idx, 1);
                                // Re-enable the corresponding pool button
                                Array.from(pool.children).forEach(poolBtn => {
                                    if (poolBtn.innerText === word && poolBtn.disabled) {
                                        poolBtn.disabled = false;
                                        poolBtn.classList.remove('selected');
                                        return false;
                                    }
                                });
                                updateBuildArea();
                            });
                            buildArea.appendChild(wbtn);
                        });
                    }
                    answerButtons.appendChild(pool);
                    answerButtons.appendChild(buildArea);
                    // Submit button
                    const submitBtn = document.createElement('button');
                    submitBtn.innerText = 'Valider';
                    submitBtn.className = 'button primary';
                    submitBtn.style.fontSize = '1.1em';
                    submitBtn.style.padding = '8px 18px';
                    submitBtn.style.marginTop = '8px';
                    submitBtn.disabled = true;
                    submitBtn.addEventListener('click', () => {
                        handleSentenceBuilderSubmit(build, question, pool, buildArea, submitBtn);
                    });
                    answerButtons.appendChild(submitBtn);
                    // Enable submit only if at least one word is selected
                    const observer = new MutationObserver(() => {
                        submitBtn.disabled = build.length === 0;
                    });
                    observer.observe(buildArea, { childList: true });
                }
                return;
            }

            // Default: multiple choice
            if(questionText) questionText.innerText = question.question;
            if (!isGuestMode && !isLeagueMode && currentQuestionIndex === jackpotIndex) {
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
            console.log('DEBUG: Calling endQuiz() - currentQuestionIndex:', currentQuestionIndex, 'gameQuestions.length:', gameQuestions.length);
            endQuiz();
        }
    }

    // Add this new function for texte à trou answer checking
    function handleTexteATrouSubmit(input, question) {
        clearInterval(timerInterval);
        const userAnswer = (input.value || '').trim().toLowerCase();
        const correctAnswer = (question.answer || '').trim().toLowerCase();
        let isCorrect = userAnswer === correctAnswer;
        input.disabled = true;
        const feedback = document.createElement('div');
        feedback.className = 'sentence-builder-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        if (isCorrect) {
            feedback.innerText = '✅ Bonne réponse !';
            score++;
        } else {
            feedback.innerHTML = `❌ Mauvaise réponse.<br><span style="font-size:1.1em;font-weight:600;">La bonne réponse était :</span><br><span style="display:inline-block;margin-top:6px;background:#fff;padding:6px 14px;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);color:#1a7f37;">${question.answer}</span>`;
        }
        answerButtons.appendChild(feedback);
        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 2000);
    }
    
    // Handle image identify answer selection
    function handleImageIdentifySelect(selectedWrap, imgObj, question, imgGrid) {
        clearInterval(timerInterval);
        // Disable all further clicks
        Array.from(imgGrid.children).forEach(wrap => {
            wrap.style.pointerEvents = 'none';
        });
        let isCorrect = !!imgObj.isCorrect;
        let correctLabel = '';
        if (isCorrect) {
            selectedWrap.style.border = '2px solid #1a7f37';
            selectedWrap.querySelector('.label').style.color = '#1a7f37';
            selectedWrap.querySelector('.label').style.fontWeight = 'bold';
            score++;
        } else {
            selectedWrap.style.border = '2px solid red';
            // Highlight the correct one
            Array.from(imgGrid.children).forEach((wrap, idx) => {
                if (question.images[idx].isCorrect) {
                    wrap.style.border = '2px solid #1a7f37';
                    wrap.querySelector('.label').style.color = '#1a7f37';
                    wrap.querySelector('.label').style.fontWeight = 'bold';
                    correctLabel = question.images[idx].label;
                }
            });
        }
        // Feedback
        const feedback = document.createElement('div');
        feedback.className = 'sentence-builder-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        if (isCorrect) {
            feedback.innerText = '✅ Bonne réponse !';
        } else {
            feedback.innerHTML = `❌ Mauvaise réponse.<br><span style="font-size:1.1em;font-weight:600;">La bonne réponse était :</span><br><span style="display:inline-block;margin-top:6px;background:#fff;padding:6px 14px;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);color:#1a7f37;">${correctLabel}</span>`;
        }
        imgGrid.parentElement.appendChild(feedback);
        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 2000);
    }

    // Handle sentence builder answer checking
    function handleSentenceBuilderSubmit(build, question, pool, buildArea, submitBtn) {
        clearInterval(timerInterval);
        submitBtn.disabled = true;
        // Disable all pool buttons
        Array.from(pool.children).forEach(btn => btn.disabled = true);
        // Disable all build area buttons
        Array.from(buildArea.children).forEach(btn => btn.disabled = true);
        const isCorrect = JSON.stringify(build) === JSON.stringify(question.answer);
        const feedback = document.createElement('div');
        feedback.className = 'sentence-builder-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        if (isCorrect) {
            feedback.innerText = '✅ Bonne réponse !';
            score++;
        } else {
            feedback.innerHTML = `❌ Mauvaise réponse.<br><span style="font-size:1.1em;font-weight:600;">La bonne phrase était :</span><br><span style="display:inline-block;margin-top:6px;background:#fff;padding:6px 14px;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);color:#1a7f37;">${question.answer.join(' ')}</span>`;
        }
        buildArea.parentElement.appendChild(feedback);
        setTimeout(() => {
            currentQuestionIndex++;
            showNextQuestion();
        }, 2500);
    }

    function startTimer() {
        const timeForQuestion = gameQuestions[currentQuestionIndex]?.time || TIME_PER_QUESTION;
        timer = timeForQuestion;
        if(timerElement) timerElement.innerText = timer;
        timerInterval = setInterval(() => {
            timer--;
            if(timerElement) timerElement.innerText = timer;
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
            if (user.focusTokens <= 0) focusBtn.classList.add('depleted');
        }
    }

    function resetState() {
        clearInterval(timerInterval);
        isTimerPaused = false;
        user = getCurrentUser();
        if (focusCount && focusBtn) {
            focusBtn.classList.remove('used-this-turn');
            if (user && user.focusTokens > 0) focusBtn.classList.remove('depleted');
            if (user) focusCount.innerText = user.focusTokens;
        }
        if(answerButtons) {
            while (answerButtons.firstChild) {
                answerButtons.removeChild(answerButtons.firstChild);
            }
        }
    }

    // In selectAnswer (multiple choice), highlight the correct option in green for incorrect answers
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
        if (!isGuestMode && !isLeagueMode) {
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
                    button.style.background = '#e6f9ea';
                    button.style.color = '#1a7f37';
                    button.style.fontWeight = 'bold';
                }
                button.disabled = true;
            });
        }
        const feedback = document.createElement('div');
        feedback.className = 'sentence-builder-feedback ' + (correct ? 'correct' : 'incorrect');
        feedback.innerText = correct ? '✅ Bonne réponse !' : '❌ Mauvaise réponse.';
        answerButtons.appendChild(feedback);
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
        console.log('DEBUG: endQuiz() called - isLeagueMode:', isLeagueMode, 'isGuestMode:', isGuestMode);
        if (isLeagueMode) {
            console.log('DEBUG: Processing league mode endQuiz');
            const leagueData = getLeagueData();
            
            // Safety check: ensure the week data exists
            if (!leagueData[currentWeekId]) {
                console.error(`League data for ${currentWeekId} not found!`);
                // Create basic modal without league data
                resultsModal.innerHTML = `
                    <div class="modal-content">
                        <h2>Défi de la Ligue Terminé !</h2>
                        <p>Votre score personnel : <strong>${score} / ${gameQuestions.length}</strong></p>
                        <div class="rewards">
                            <p>Félicitations pour avoir terminé le défi !</p>
                        </div>
                        <a href="competition.html" class="button secondary" style="margin-top: 10px;">Voir le Classement</a>
                    </div>
                `;
                return;
            }
            
            const schoolData = leagueData[currentWeekId].schools[user.school] || { totalScore: 0, participants: 0 };
            const oldAvg = (schoolData.totalScore / schoolData.participants || 0).toFixed(2);
            
            recordPlayerScore(currentWeekId, user, score);
            
            const newLeagueData = getLeagueData();
            const newSchoolData = newLeagueData[currentWeekId].schools[user.school];
            const newAvg = (newSchoolData.totalScore / newSchoolData.participants).toFixed(2);

            user.leagueParticipation[currentWeekId] = true;
            saveCurrentUser(user);

            resultsModal.innerHTML = `
                <div class="modal-content">
                    <h2>Défi de la Ligue Terminé !</h2>
                    <p>Votre score personnel : <strong>${score} / ${gameQuestions.length}</strong></p>
                    <div class="rewards">
                        <p>Grâce à vous, la moyenne de ${user.school} est passée de <strong>${oldAvg}</strong> à <strong>${newAvg}</strong>!</p>
                    </div>
                    <button id="share-btn" class="button primary share-btn">Partager mon Exploit!</button>
                    <a href="competition.html" class="button secondary" style="margin-top: 10px;">Voir le Classement</a>
                </div>
            `;

            document.getElementById('share-btn').addEventListener('click', () => {
                const shareText = `J'ai obtenu un score de ${score}/${gameQuestions.length} pour ${user.school} dans le Défi National Askiaverse !`;
                if (navigator.share) {
                    navigator.share({
                        title: 'Exploit Askiaverse!',
                        text: shareText,
                        url: window.location.origin,
                    });
                } else {
                    alert("La fonction de partage n'est pas supportée sur ce navigateur.");
                }
            });

        } else if (isGuestMode) {
            let xpEarned = score * 10;
            let orbsEarned = (score / gameQuestions.length >= 0.7) ? Math.floor((score / gameQuestions.length) * 20) : 0;
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
            let orbsEarned = 0;
            const performance = score / gameQuestions.length;
            if (performance >= 0.7) orbsEarned = Math.floor(performance * 20);
            if (isFirstCompletion) {
                orbsEarned += 50;
                // Ensure completedQuizzes exists before pushing
                if (!user.completedQuizzes) {
                    user.completedQuizzes = [];
                }
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
        
        console.log('DEBUG: About to show results modal');
        if(resultsModal) {
            resultsModal.classList.remove('hidden');
            console.log('DEBUG: Results modal should now be visible');
        } else {
            console.log('DEBUG: resultsModal element not found!');
        }
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
        if (!isTimerPaused) startTimer();
        if(pauseModal) pauseModal.classList.add('hidden');
    }
}); 