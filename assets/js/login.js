import { login, initializeDatabase } from './auth.js';
import { initAnimation } from './background-animation.js';

document.addEventListener('DOMContentLoaded', () => {
    initAnimation();
    initializeDatabase();

    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const loginSuccess = login(username, password);
        if (loginSuccess) {
            window.location.href = 'dashboard.html';
        } else {
            errorMessage.innerText = "Nom d'utilisateur ou mot de passe incorrect.";
        }
    });
});
