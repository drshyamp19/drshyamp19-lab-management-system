import { auth } from "./firebase-init.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const errorMessage = document.getElementById("errorMessage");

// जर युझर आधीपासून लॉगिन असेल, तर थेट डॅशबोर्डवर पाठवा
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "dashboard.html";
    }
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginBtn.innerText = "Signing in...";
    loginBtn.disabled = true;
    errorMessage.classList.add("hidden");

    try {
        const email = emailInput.value;
        const password = passwordInput.value;
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html"; // लॉगिन झाल्यावर डॅशबोर्डला जा
    } catch (error) {
        errorMessage.innerText = "Error: " + error.message;
        errorMessage.classList.remove("hidden");
        loginBtn.innerText = "Sign In";
        loginBtn.disabled = false;
    }
});
