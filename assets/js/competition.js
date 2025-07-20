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
    const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
    const mySchoolStatsContainer = document.getElementById('my-school-stats');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const countdownTimer = document.getElementById('countdown-timer');
    const legendsContainer = document.getElementById('legends-container');
    const championsContainer = document.getElementById('champions-container');
    const risingStarsContainer = document.getElementById('rising-stars-container');

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

    // --- Mock Data ---
    const mockLeagueData = {
        week_1: {
            schools: {
                "École Pilote": { city: "Gao", totalScore: 85, participants: 10 },
                "Lycée Askia": { city: "Bamako", totalScore: 120, participants: 15 },
                "École Liberté": { city: "Sikasso", totalScore: 70, participants: 8 },
                "Le Flamboyant": { city: "Bamako", totalScore: 150, participants: 18 },
                "Gao International School": { city: "Gao", totalScore: 95, participants: 12 },
            },
            individualScores: [
                { player: "Aïcha", school: "Le Flamboyant", score: 10 },
                { player: "Moussa", school: "Lycée Askia", score: 9 },
                { player: "hamza", school: "École Pilote", score: 9 },
                { player: "Fatoumata", school: "Gao International School", score: 8 },
                { player: "Sékou", school: "Lycée Askia", score: 8 },
                { player: "Mariam", school: "École Pilote", score: 8 },
            ]
        }
    };

    const allSchools = Object.entries(mockLeagueData.week_1.schools).map(([name, data]) => ({
        name: name,
        city: data.city,
        avgScore: (data.totalScore / data.participants).toFixed(2)
    }));

    // --- Countdown Timer Logic ---
    function startCountdown() {
        const competitionEndDate = new Date();
        competitionEndDate.setDate(competitionEndDate.getDate() + 3);

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = competitionEndDate - now;
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            if (countdownTimer) {
                countdownTimer.innerHTML = `La compétition se termine dans : ${days}j ${hours}h ${minutes}m ${seconds}s`;
            }

            if (distance < 0) {
                clearInterval(interval);
                if (countdownTimer) countdownTimer.innerHTML = "Compétition terminée !";
            }
        }, 1000);
    }

    // --- Leaderboard Logic ---
    function renderLeaderboard(filterType = 'national') {
        if (!leaderboardTableBody || !leaderboardTitle) return;

        let schoolsToDisplay = [];

        if (filterType === 'regional') {
            leaderboardTitle.innerText = `Classement Régional - ${user.city}`;
            schoolsToDisplay = allSchools.filter(school => school.city === user.city);
        } else {
            leaderboardTitle.innerText = 'Classement National - Semaine 1';
            schoolsToDisplay = [...allSchools];
        }

        schoolsToDisplay.sort((a, b) => b.avgScore - a.avgScore);
        
        leaderboardTableBody.innerHTML = ''; 

        schoolsToDisplay.forEach((school, index) => {
            const row = document.createElement('tr');
            
            // THE FIX: Add a safety check to prevent the crash
            if (school && school.name && user && user.school && school.name.trim() === user.school.trim()) {
                row.classList.add('user-school');
            }

            row.innerHTML = `
                <td>#${index + 1}</td>
                <td>${school.name}</td>
                <td>${school.city}</td>
                <td>${school.avgScore}</td>
            `;
            leaderboardTableBody.appendChild(row);
        });
    }
    
    function renderMySchoolStats() {
        if (mySchoolStatsContainer) {
            const mySchoolData = mockLeagueData.week_1.schools[user.school];
            if (mySchoolData) {
                const sortedSchools = [...allSchools].sort((a, b) => b.avgScore - a.avgScore);
                const nationalRank = sortedSchools.findIndex(s => s.name === user.school) + 1;
                mySchoolStatsContainer.innerHTML = `
                    <h3>Statistiques de ${user.school}</h3>
                    <div class="stat-item">
                        <span>Classement National</span>
                        <span class="stat-value">#${nationalRank}</span>
                    </div>
                    <div class="stat-item">
                        <span>Score Moyen</span>
                        <span class="stat-value">${(mySchoolData.totalScore / mySchoolData.participants).toFixed(2)}</span>
                    </div>
                    <div class="stat-item">
                        <span>Participants</span>
                        <span class="stat-value">${mySchoolData.participants}</span>
                    </div>
                `;
            } else {
                mySchoolStatsContainer.innerHTML = `<h3>Votre école n'a pas encore participé cette semaine.</h3>`;
            }
        }
    }

    function renderHallOfFame() {
        if (legendsContainer) {
            const legends = [...mockLeagueData.week_1.individualScores].sort((a, b) => b.score - a.score).slice(0, 3);
            legendsContainer.innerHTML = legends.map((player, index) => `
                <div class="player-card">
                    <div class="player-rank">#${index + 1}</div>
                    <div class="player-info">
                        <div class="player-name">${player.player}</div>
                        <div class="player-school">${player.school}</div>
                    </div>
                    <div class="player-score">${player.score}/10</div>
                </div>
            `).join('');
        }

        if (championsContainer) {
            const schoolChampions = mockLeagueData.week_1.individualScores.filter(p => p.school === user.school).sort((a, b) => b.score - a.score).slice(0, 5);
            if (schoolChampions.length > 0) {
                championsContainer.innerHTML = schoolChampions.map((player, index) => `
                    <div class="player-card">
                        <div class="player-rank">#${index + 1}</div>
                        <div class="player-info">
                            <div class="player-name">${player.player}</div>
                        </div>
                        <div class="player-score">${player.score}/10</div>
                    </div>
                `).join('');
            } else {
                championsContainer.innerHTML = `<p>Aucun champion de votre école n'a encore été enregistré.</p>`;
            }
        }

        if (risingStarsContainer) {
            risingStarsContainer.innerHTML = `
                <div class="school-card">
                    <div class="player-rank">🚀</div>
                    <div class="player-info">
                        <div class="school-name">École Liberté</div>
                        <div class="school-improvement">+1.5 points d'amélioration</div>
                    </div>
                </div>
            `;
        }
    }

    // --- Filter Button Event Listeners ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const filter = button.dataset.filter;
            renderLeaderboard(filter);
        });
    });

    // --- Initial Render ---
    renderLeaderboard('national');
    renderMySchoolStats();
    startCountdown();
    renderHallOfFame();
});
