import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const userNameDisplay = document.getElementById("userNameDisplay");
const userRoleDisplay = document.getElementById("userRoleDisplay");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html"; // युझर लॉगिन नसेल तर लॉगिन पेजवर पाठवा
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Block deleted users
            if(userData.status === "Inactive") {
                alert("Your account has been deleted or blocked by the Admin.");
                signOut(auth);
                return;
            }

            userNameDisplay.innerText = userData.name;
            userRoleDisplay.innerText = userData.role;
        } else {
            userNameDisplay.innerText = user.email;
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
});

logoutBtn?.addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});
