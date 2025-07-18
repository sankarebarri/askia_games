import { getCurrentUser, logout, saveCurrentUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    let user = getCurrentUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (user.lastPlayedDate !== today) {
        user.focusTokens = 3;
        user.lastPlayedDate = today;
        saveCurrentUser(user);
    }
    
    // --- DOM Selections ---
    const gradeSelector = document.getElementById('grade-selector');
    const challengeSection = document.getElementById('challenge-section');
    const challengeTitle = document.getElementById('challenge-title');
    const subjectGrid = document.getElementById('subject-grid');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const logoutBtn = document.getElementById('logout-button');
    const topicModal = document.getElementById('topic-modal');
    const closeTopicModalBtn = document.getElementById('close-topic-modal-btn');
    const topicModalTitle = document.getElementById('topic-modal-title');
    const topicModalButtons = document.getElementById('topic-modal-buttons');
    const gameModeModal = document.getElementById('game-mode-modal');
    const closeGameModeModalBtn = document.getElementById('close-game-mode-modal-btn');
    const gameModeModalTitle = document.getElementById('game-mode-modal-title');
    const gameModeModalButtons = document.getElementById('game-mode-modal-buttons');
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const rulesModal = document.getElementById('rules-modal');
    const closeRulesBtn = document.getElementById('close-rules-btn');

    // --- Populate UI ---
    document.getElementById('level-stat').innerText = user.level;
    document.getElementById('orbs-stat').innerText = user.orbs;
    document.getElementById('focus-tokens-stat').innerText = user.focusTokens;
    document.getElementById('username-display').innerText = user.username;
    const xpPercentage = (user.xp / user.xpToNextLevel) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercentage}%`;

    // --- Event Listeners ---
    logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    
    userMenuBtn.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
        userMenuBtn.classList.toggle('open');
    });

    window.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.add('hidden');
            userMenuBtn.classList.remove('open');
        }
    });

    gradeSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('grade-btn')) {
            handleGradeSelection(e.target);
        }
    });

    subjectGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.subject-card');
        if (card) {
            handleSubjectSelection(card);
        }
    });

    howToPlayBtn.addEventListener('click', () => rulesModal.classList.remove('hidden'));
    closeRulesBtn.addEventListener('click', () => rulesModal.classList.add('hidden'));
    closeTopicModalBtn.addEventListener('click', () => topicModal.classList.add('hidden'));
    closeGameModeModalBtn.addEventListener('click', () => gameModeModal.classList.add('hidden'));

    // --- Grade & Subject Logic ---
    const availableGrades = [6, 7];
    availableGrades.forEach(grade => {
        const button = document.createElement('button');
        button.innerText = `${grade}ème`;
        button.classList.add('grade-btn');
        button.dataset.grade = grade;
        gradeSelector.appendChild(button);
    });

    function handleGradeSelection(selectedButton) {
        const selectedGrade = selectedButton.dataset.grade;
        document.querySelectorAll('.grade-btn').forEach(btn => btn.classList.remove('selected'));
        selectedButton.classList.add('selected');
        challengeTitle.innerText = `Défis pour la ${selectedGrade}ème`;
        loadSubjectsForGrade(selectedGrade);
    }

    async function loadSubjectsForGrade(grade) {
        try {
            const res = await fetch(`assets/data/grade_${grade}/subjects.json`);
            if (!res.ok) throw new Error(`Cannot find subjects for grade ${grade}`);
            const subjects = await res.json();
            subjectGrid.innerHTML = '';
            challengeSection.classList.remove('hidden');
            for (const subjectId in subjects) {
                const subject = subjects[subjectId];
                const card = document.createElement('div');
                card.classList.add('subject-card');
                card.dataset.subject = subjectId;
                card.dataset.grade = grade;
                const icons = {maths: '🧮', french: '📖', english: '💬', 'hist-geo': '🌍'};
                card.innerHTML = `<div class="icon">${icons[subjectId] || '📚'}</div><div class="subject-title">${subject.title}</div>`;
                subjectGrid.appendChild(card);
            }
        } catch (error) {
            console.error(error);
            challengeSection.classList.remove('hidden');
            subjectGrid.innerHTML = `<p>Les défis pour cette classe ne sont pas encore disponibles.</p>`;
        }
    }
    
    const defaultGradeBtn = gradeSelector.querySelector(`[data-grade='${user.defaultGrade}']`);
    if (defaultGradeBtn) {
        defaultGradeBtn.click();
    }

    async function handleSubjectSelection(card) {
        const grade = card.dataset.grade;
        const subjectId = card.dataset.subject;
        try {
            const res = await fetch(`assets/data/grade_${grade}/subjects.json`);
            const subjects = await res.json();
            const subjectData = subjects[subjectId];
            if (!subjectData) return;
            openTopicModal(grade, subjectId, subjectData);
        } catch (error) {
            alert("Impossible de charger les thèmes pour ce sujet.");
        }
    }

    function openTopicModal(grade, subjectId, subjectData) {
        topicModalTitle.innerText = `Choisir un Thème en ${subjectData.title}`;
        topicModalButtons.innerHTML = '';
        if (subjectData.topics && Object.keys(subjectData.topics).length > 0) {
            for (const topicId in subjectData.topics) {
                const topicData = subjectData.topics[topicId];
                const button = document.createElement('button');
                button.innerText = topicData.title;
                button.classList.add('topic-btn');
                button.addEventListener('click', () => {
                    topicModal.classList.add('hidden');
                    openGameModeModal(grade, subjectId, topicId, topicData);
                });
                topicModalButtons.appendChild(button);
            }
        }
        topicModal.classList.remove('hidden');
    }

    function openGameModeModal(grade, subjectId, topicId, topicData) {
        gameModeModalTitle.innerText = `${topicData.title}: Choisis ton Mode de Jeu`;
        gameModeModalButtons.innerHTML = '';
        const gameModes = topicData.gameModes || ['multiple_choice'];
        const friendlyNames = {
            multiple_choice: "Quiz Rapide ✔️",
            equation_builder: "Constructeur d'Équation 🖐️",
            image_identify: "Défi Visuel 🖼️",
            sentence_builder: "Constructeur de Phrases ✍️"
        };
        gameModes.forEach(modeId => {
            const button = document.createElement('button');
            button.innerText = friendlyNames[modeId] || modeId;
            button.classList.add('topic-btn');
            button.addEventListener('click', () => {
                window.location.href = `quiz.html?grade=${grade}&subject=${subjectId}&topic=${topicId}&mode=${modeId}`;
            });
            gameModeModalButtons.appendChild(button);
        });
        gameModeModal.classList.remove('hidden');
    }
});
