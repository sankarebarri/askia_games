// This module manages all data related to the Askia National League.

const LEAGUE_DB_KEY = 'askiaverse_league_data';

// --- Mock Data (The "Database" for our MVP) ---
const initialLeagueData = {
    "week_1": {
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

/**
 * Gets the entire league database from localStorage.
 * If it doesn't exist, it creates it from the initial mock data.
 * @returns {Object} The league data object.
 */
export function getLeagueData() {
    const data = localStorage.getItem(LEAGUE_DB_KEY);
    if (!data) {
        // If no data exists, initialize it with our mock data
        localStorage.setItem(LEAGUE_DB_KEY, JSON.stringify(initialLeagueData));
        return initialLeagueData;
    }
    return JSON.parse(data);
}

/**
 * Saves the entire league database back to localStorage.
 * @param {Object} leagueData The complete league data object to save.
 */
function saveLeagueData(leagueData) {
    localStorage.setItem(LEAGUE_DB_KEY, JSON.stringify(leagueData));
}

/**
 * Records a player's score for a specific week.
 * This function updates the school's total score and participant count,
 * and adds the individual score to the list.
 * @param {string} weekId - The ID of the week (e.g., "week_1").
 * @param {Object} user - The user object of the player.
 * @param {number} score - The player's score for the quiz.
 */
export function recordPlayerScore(weekId, user, score) {
    const leagueData = getLeagueData();
    const weekData = leagueData[weekId];

    if (!weekData) {
        console.error(`League data for ${weekId} not found!`);
        return;
    }

    // Update individual scores
    weekData.individualScores.push({
        player: user.username,
        school: user.school,
        score: score
    });

    // Update school aggregate scores
    if (weekData.schools[user.school]) {
        weekData.schools[user.school].totalScore += score;
        weekData.schools[user.school].participants += 1;
    } else {
        // If the school is not yet in the league, add it
        weekData.schools[user.school] = {
            city: user.city,
            totalScore: score,
            participants: 1
        };
    }

    saveLeagueData(leagueData);
}
