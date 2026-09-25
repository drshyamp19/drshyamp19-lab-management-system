import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, getDoc, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const userNameDisplay = document.getElementById("userNameDisplay");
const userRoleDisplay = document.getElementById("userRoleDisplay");
const statTotal = document.getElementById("statTotal");
const statIssued = document.getElementById("statIssued");
const logoutBtn = document.getElementById("logoutBtn");

const ROLE_LABELS = {
  hod: "HOD (All Labs)",
  incharge: "Lab In-charge",
  assistant: "Lab Assistant"
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) {
    await signOut(auth);
    window.location.href = "index.html";
    return;
  }

  const userData = userSnap.data();

  userNameDisplay.textContent = userData.name || user.email;
  userRoleDisplay.textContent = ROLE_LABELS[userData.role] || userData.role;

  if (userData.role === "hod") {
    const navLabs = document.getElementById("navLabs");
    if (navLabs) navLabs.classList.remove("hidden");
  }

  // पुढच्या pages (components/students/transactions) साठी session मध्ये ठेवतो
  sessionStorage.setItem("labSystemUser", JSON.stringify({
    uid: user.uid,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    labId: userData.labId || null
  }));

  loadStats(userData);
});

async function loadStats(userData) {
  try {
    const componentsRef = collection(db, "components");
    const compQuery = userData.role === "hod"
      ? componentsRef
      : query(componentsRef, where("labId", "==", userData.labId));

    const compSnap = await getDocs(compQuery);
    statTotal.textContent = compSnap.size;

    let issuedCount = 0;
    compSnap.forEach((docSnap) => {
      const c = docSnap.data();
      if (
        c.category === "non-consumable" &&
        typeof c.totalQuantity === "number" &&
        typeof c.availableQuantity === "number"
      ) {
        issuedCount += (c.totalQuantity - c.availableQuantity);
      }
    });
    statIssued.textContent = issuedCount;
  } catch (err) {
    console.error("Dashboard stats error:", err);
  }
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.removeItem("labSystemUser");
  window.location.href = "index.html";
});
