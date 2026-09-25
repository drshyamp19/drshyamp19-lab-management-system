import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, getDocs, collection, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const form = document.getElementById("registerForm");
const errorMsg = document.getElementById("regErrorMessage");
const btn = document.getElementById("registerBtn");

function showError(text) {
  errorMsg.textContent = text;
  errorMsg.classList.remove("hidden");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Creating...";

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;

  try {
    // या page वरून फक्त पहिलाच HOD तयार होऊ शकतो (first-time setup)
    const hodQuery = query(collection(db, "users"), where("role", "==", "hod"));
    const hodSnap = await getDocs(hodQuery);
    if (!hodSnap.empty) {
      showError("HOD account आधीच अस्तित्वात आहे. कृपया Login page वापरा.");
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role: "hod",
      labId: null,
      status: "active",
      createdAt: new Date().toISOString()
    });

    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    if (err.code === "auth/email-already-in-use") {
      showError("हा Email आधीच वापरात आहे.");
    } else {
      showError("Account तयार करताना error आली: " + err.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Create HOD Account";
  }
});
