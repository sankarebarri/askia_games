// This module exports functions for user authentication.
export const USER_KEY = 'askiaverse_user';

export function getCurrentUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
}

export function saveUser(userData) {
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
}

export function logout() {
    localStorage.removeItem(USER_KEY);
    window.location.href = 'index.html';
}

export function createDefaultUser() {
    if (!getCurrentUser()) {
        console.log('No user found. Creating a default user for testing.');
        const defaultUser = {
            username: 'hamza',
            level: 1,
            xp: 30,
            xpToNextLevel: 100,
            orbs: 150,
            // --- NEW PROPERTIES ---
            currentStreak: 0,
            lastPlayedDate: null, // Set to null to trigger "new day" on first login
            focusTokens: 3,
            completedQuizzes: [] // To store IDs of completed quizzes for first-time bonuses
        };
        saveUser(defaultUser);
    }
}