import { register, login, initializeDatabase, getCurrentUser, saveCurrentUser } from './auth.js';
import { initAnimation } from './background-animation.js';

document.addEventListener('DOMContentLoaded', () => {
    initAnimation();
    initializeDatabase();

    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessage.innerText = '';

        const username = registerForm.username.value;
        const password = registerForm.password.value;
        const passwordConfirm = registerForm['password-confirm'].value;
        const defaultGrade = registerForm['default-grade'].value;
        const city = registerForm.city.value;
        const school = registerForm.school.value;

        if (!username || !password || !defaultGrade || !city || !school) {
            errorMessage.innerText = "Veuillez remplir tous les champs.";
            return;
        }
        if (password !== passwordConfirm) {
            errorMessage.innerText = "Les mots de passe ne correspondent pas.";
            return;
        }

        const result = register(username, password, defaultGrade, city, school);

        if (result.success) {
            login(username, password);

            const urlParams = new URLSearchParams(window.location.search);
            const guestXp = parseInt(urlParams.get('guestScore'), 10) || 0;
            const guestOrbs = parseInt(urlParams.get('guestOrbs'), 10) || 0;

            if (guestXp > 0 || guestOrbs > 0) {
                let newUser = getCurrentUser();
                if (newUser) {
                    newUser.xp += guestXp;
                    newUser.orbs += guestOrbs;
                    saveCurrentUser(newUser);
                }
            }
            
            window.location.href = 'dashboard.html';
        } else {
            errorMessage.innerText = result.message;
        }
    });
});
