import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");
const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const registerBtn = document.getElementById("registerBtn");
const regErrorMessage = document.getElementById("regErrorMessage");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerBtn.innerText = "Creating Account...";
    registerBtn.disabled = true;
    regErrorMessage.classList.add("hidden");

    try {
        const name = regName.value;
        const email = regEmail.value;
        const password = regPassword.value;

        // १. Firebase Authentication मध्ये युझर बनवा
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // २. Firestore Database मध्ये युझरची माहिती HOD रोल सोबत सेव्ह करा
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            role: "HOD",
            status: "Active",
            labId: null,
            createdAt: new Date()
        });

        alert("अकाउंट यशस्वीरित्या तयार झाले! आता तुम्ही लॉगिन करू शकता.");
        window.location.href = "index.html"; // लॉगिन पेजवर पाठवा
        
    } catch (error) {
        regErrorMessage.innerText = "Error: " + error.message;
        regErrorMessage.classList.remove("hidden");
        registerBtn.innerText = "Create HOD Account";
        registerBtn.disabled = false;
    }
});
