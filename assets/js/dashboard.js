import { getCurrentUser, logout, createDefaultUser, saveUser } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // We are not running the constellation animation on this page anymore
    // to keep the background clean.
    
    createDefaultUser();
    let user = getCurrentUser();

    // Daily Reset Logic
    const today = new Date().toISOString().split('T')[0];
    if (user && user.lastPlayedDate !== today) {
        user.focusTokens = 3;
        user.lastPlayedDate = today;
        saveUser(user);
    }
    
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Populate user stats in the sidebar
    document.getElementById('welcome-message').innerText = `Bienvenue, ${user.username}!`;
    document.getElementById('level-stat').innerText = user.level;
    document.getElementById('orbs-stat').innerText = `${user.orbs} orbs`;
    document.getElementById('focus-tokens-stat').innerText = `${user.focusTokens} 🧘`;
    document.getElementById('xp-stat').innerText = `${user.xp} / ${user.xpToNextLevel} XP`;
    const xpPercentage = (user.xp / user.xpToNextLevel) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercentage}%`;

    // Logout button listener
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // --- Grade, Subject, and Topic Selection Logic ---
    const dashboardLayout = document.getElementById('dashboard-layout');
    const gradeSelector = document.getElementById('grade-selector');
    const challengeSection = document.getElementById('challenge-section');
    const subjectGrid = document.getElementById('subject-grid');
    const topicModal = document.getElementById('topic-modal');

    const availableGrades = [6, 7, 8, 9];

    availableGrades.forEach(grade => {
        const button = document.createElement('button');
        button.innerText = `${grade}ème`;
        button.classList.add('grade-btn');
        button.dataset.grade = grade;
        gradeSelector.appendChild(button);
    });

    gradeSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('grade-btn')) {
            const selectedGrade = e.target.dataset.grade;
            
            document.querySelectorAll('.grade-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');

            // This logic now applies the class that the CSS uses to set the accent color
            dashboardLayout.className = 'dashboard-layout'; 
            dashboardLayout.classList.add(`grade-theme-${selectedGrade}`);
            
            loadSubjectsForGrade(selectedGrade);
        }
    });

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
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
                
                const icons = {maths: '🧮', french: '📖', english: '💬', 'hist-geo': '🌍'};
                card.innerHTML = `
                    <div class="icon">${icons[subjectId] || '📚'}</div>
                    <div class="subject-title">${subject.title}</div>
                `;
                subjectGrid.appendChild(card);
            }
        } catch (error) {
            console.error(error);
            subjectGrid.innerHTML = `<p style="grid-column: 1 / -1; font-size: 1.2em; color: rgba(255,255,255,0.7);">Les défis pour cette classe ne sont pas encore disponibles.</p>`;
            challengeSection.classList.remove('hidden');
        }
    }

    subjectGrid.addEventListener('click', async (e) => {
        const card = e.target.closest('.subject-card');
        if (card) {
            const grade = card.dataset.grade;
            const subjectId = card.dataset.subject;

            try {
                const res = await fetch(`assets/data/grade_${grade}/subjects.json`);
                if (!res.ok) throw new Error('Could not load subject details');
                const subjects = await res.json();
                const subjectData = subjects[subjectId];

                if (!subjectData) return;
                openTopicModal(grade, subjectId, subjectData);

            } catch (error) {
                console.error("Error opening topic modal:", error);
                alert("Impossible de charger les thèmes pour ce sujet.");
            }
        }
    });

    function openTopicModal(grade, subjectId, subjectData) {
        const modalTitle = document.getElementById('topic-modal-title');
        const modalButtonsContainer = document.getElementById('topic-modal-buttons');
        const closeModalBtn = document.getElementById('close-modal-btn');
        
        modalTitle.innerText = `Choisir un Thème en ${subjectData.title}`;
        modalButtonsContainer.innerHTML = '';

        if (subjectData.topics && Object.keys(subjectData.topics).length > 0) {
            for (const topicId in subjectData.topics) {
                const button = document.createElement('button');
                button.innerText = subjectData.topics[topicId];
                button.classList.add('topic-btn');
                button.addEventListener('click', () => {
                    window.location.href = `quiz.html?grade=${grade}&subject=${subjectId}&topic=${topicId}`;
                });
                modalButtonsContainer.appendChild(button);
            }
            
            const randomButton = document.createElement('button');
            randomButton.innerText = 'Mélange Aléatoire';
            randomButton.classList.add('topic-btn', 'random-mix');
            randomButton.addEventListener('click', () => {
                window.location.href = `quiz.html?grade=${grade}&subject=${subjectId}&topic=random`;
            });
            modalButtonsContainer.appendChild(randomButton);
        } else {
            const generalButton = document.createElement('button');
            generalButton.innerText = `Commencer le défi '${subjectData.title}'`;
            generalButton.classList.add('topic-btn');
            generalButton.addEventListener('click', () => {
                window.location.href = `quiz.html?grade=${grade}&subject=${subjectId}&topic=default`;
            });
            modalButtonsContainer.appendChild(generalButton);
        }

        topicModal.classList.remove('hidden');

        closeModalBtn.addEventListener('click', () => {
            topicModal.classList.add('hidden');
        }, { once: true });
    }
});