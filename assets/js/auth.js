const USERS_DB_KEY = 'askiaverse_users';
const CURRENT_USER_KEY = 'askiaverse_currentUser';

function getAllUsers() {
    const users = localStorage.getItem(USERS_DB_KEY);
    return users ? JSON.parse(users) : [];
}

function saveAllUsers(usersArray) {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(usersArray));
}

export function getCurrentUser() {
    const username = localStorage.getItem(CURRENT_USER_KEY);
    if (!username) return null;
    const allUsers = getAllUsers();
    return allUsers.find(user => user.username === username) || null;
}

export function saveCurrentUser(userData) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    const allUsers = getAllUsers();
    const userIndex = allUsers.findIndex(user => user.username === currentUser.username);
    if (userIndex !== -1) {
        allUsers[userIndex] = userData;
        saveAllUsers(allUsers);
    }
}

export function logout() {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = 'index.html';
}

export function login(username, password) {
    const allUsers = getAllUsers();
    const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user && user.password === password) {
        localStorage.setItem(CURRENT_USER_KEY, user.username);
        return true;
    }
    return false;
}

export function register(username, password, defaultGrade, city, school) {
    const allUsers = getAllUsers();
    if (allUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { success: false, message: "Ce nom d'utilisateur existe déjà." };
    }

    const newUser = {
        username: username,
        password: password,
        defaultGrade: parseInt(defaultGrade, 10),
        city: city,
        school: school,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        orbs: 50,
        focusTokens: 3,
        currentStreak: 0,
        lastPlayedDate: null,
        completedQuizzes: [],
        // NEW: Property to track league participation
        leagueParticipation: {} // e.g., { "week_1": true }
    };

    allUsers.push(newUser);
    saveAllUsers(allUsers);
    return { success: true, message: "Compte créé avec succès!" };
}

export function initializeDatabase() {
    const allUsers = getAllUsers();
    if (allUsers.length === 0) {
        const hamza = {
            username: 'hamza',
            password: '123456',
            defaultGrade: 6,
            city: 'Gao',
            school: 'École Pilote',
            level: 1,
            xp: 30,
            xpToNextLevel: 100,
            orbs: 150,
            focusTokens: 3,
            currentStreak: 0,
            lastPlayedDate: null,
            completedQuizzes: [],
            leagueParticipation: {}
        };
        allUsers.push(hamza);
        saveAllUsers(allUsers);
    }
}
