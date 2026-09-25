import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// प्रत्येक protected page वर पहिली line म्हणून वापरा:
//   const currentUser = await requireAuth();
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        window.location.href = "index.html";
        return;
      }
      const userData = { uid: user.uid, ...snap.data() };
      sessionStorage.setItem("labSystemUser", JSON.stringify(userData));
      resolve(userData);
    });
  });
}

export async function logout() {
  await signOut(auth);
  sessionStorage.removeItem("labSystemUser");
  window.location.href = "index.html";
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function nowIso() {
  return new Date().toISOString();
}

export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
