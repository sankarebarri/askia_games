import { getCurrentUser, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // --- DOM Selections ---
    const levelStat = document.getElementById('level-stat');
    const orbsStat = document.getElementById('orbs-stat');
    const focusTokensStat = document.getElementById('focus-tokens-stat');
    const usernameDisplay = document.getElementById('username-display');
    const xpBar = document.getElementById('xp-bar');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const logoutBtn = document.getElementById('logout-button');
    const guildName = document.getElementById('guild-name');
    const questInfo = document.getElementById('quest-info');
    const membersList = document.getElementById('members-list');
    const messagesContainer = document.getElementById('messages-container');

    // --- Populate Header HUD ---
    if (levelStat) levelStat.innerText = user.level;
    if (orbsStat) orbsStat.innerText = user.orbs;
    if (focusTokensStat) focusTokensStat.innerText = user.focusTokens;
    if (usernameDisplay) usernameDisplay.innerText = user.username;
    if (xpBar) {
        const xpPercentage = (user.xp / user.xpToNextLevel) * 100;
        xpBar.style.width = `${xpPercentage}%`;
    }

    // --- User Menu Logic ---
    if (userMenuBtn && userDropdown) {
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
    }
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    // --- Mock Data for UI/UX ---
    const mockGuildData = {
        name: "Les Érudits du Sahel",
        quest: {
            title: "Maîtrise des Mathématiques",
            description: "Répondez correctement à 500 questions de mathématiques en équipe cette semaine.",
            currentProgress: 327,
            goal: 500
        },
        members: [
            { username: "hamza", city: "Gao", school: "École Pilote" },
            { username: "Aïcha", city: "Bamako", school: "Lycée Askia" },
            { username: "Moussa", city: "Sikasso", school: "École Liberté" },
            { username: "Fatoumata", city: "Gao", school: "Gao International School" }
        ],
        messages: [
            { author: "Aïcha", body: "Bonjour à tous ! Prêts pour la quête de cette semaine ?" },
            { author: "Moussa", body: "Oui ! Je vais faire quelques quiz d'algèbre maintenant." },
            { author: "hamza", body: "Super ! J'ai ajouté 20 points hier. On peut le faire !" }
        ]
    };

    // --- Populate Guild Hall with Mock Data ---
    if (guildName) guildName.innerText = mockGuildData.name;

    // Populate Quest Panel
    if (questInfo) {
        const quest = mockGuildData.quest;
        const progressPercent = (quest.currentProgress / quest.goal) * 100;
        questInfo.innerHTML = `
            <h3 class="quest-title">${quest.title}</h3>
            <p class="quest-description">${quest.description}</p>
            <div class="quest-progress-bar-container">
                <div class="quest-progress-bar" style="width: ${progressPercent}%;"></div>
            </div>
            <p class="quest-progress-text">${quest.currentProgress} / ${quest.goal}</p>
        `;
    }

    // Populate Members Panel
    if (membersList) {
        membersList.innerHTML = mockGuildData.members.map(member => `
            <div class="member-card">
                <div class="member-avatar"></div>
                <div class="member-info">
                    <div class="name">${member.username}</div>
                    <div class="details">${member.school}, ${member.city}</div>
                </div>
            </div>
        `).join('');
    }

    // Populate Messages Panel
    if (messagesContainer) {
        messagesContainer.innerHTML = mockGuildData.messages.map(msg => `
            <div class="message-card">
                <div class="message-header">${msg.author} a dit :</div>
                <p class="message-body">${msg.body}</p>
            </div>
        `).join('');
    }
});
