import { auth, db } from "./firebase-init.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("registerBtn");
    btn.innerText = "Creating Admin...";
    btn.disabled = true;

    try {
        const name = document.getElementById("regName").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Super Admin gets ALL permissions including 'users'
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
            role: "ADMIN", // Changed from HOD to ADMIN
            permissions: ["components", "students", "transactions", "reports", "users"],
            status: "Active",
            createdAt: new Date()
        });

        alert("Main Admin Account Created! Please Login.");
        window.location.href = "index.html"; 
        
    } catch (error) {
        alert("Error: " + error.message);
        btn.innerText = "Create Admin Account";
        btn.disabled = false;
    }
});
