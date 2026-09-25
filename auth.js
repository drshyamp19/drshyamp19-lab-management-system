import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMessage");
const btn = document.getElementById("loginBtn");

function showError(text) {
  errorMsg.textContent = text;
  errorMsg.classList.remove("hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Signing in...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userSnap = await getDoc(doc(db, "users", cred.user.uid));

    if (!userSnap.exists()) {
      showError("User profile Firestore मध्ये सापडली नाही. HOD/Admin ला संपर्क करा.");
      auth.signOut();
      return;
    }

    const userData = userSnap.data();

    if (userData.status === "inactive") {
      showError("तुमचं account निष्क्रिय (inactive) केलेलं आहे.");
      auth.signOut();
      return;
    }

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    showError("Login अयशस्वी: Email किंवा Password चुकीचा आहे.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
});
