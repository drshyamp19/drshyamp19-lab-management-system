import { requireAuth, logout, escapeHtml } from "./common.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const accessDenied = document.getElementById("accessDenied");
const labsContent = document.getElementById("labsContent");
const userRoleDisplay = document.getElementById("userRoleDisplay");
const navLabs = document.getElementById("navLabs");
const showFormBtn = document.getElementById("showFormBtn");
const labForm = document.getElementById("labForm");
const cancelLabBtn = document.getElementById("cancelLabBtn");
const saveLabBtn = document.getElementById("saveLabBtn");
const labError = document.getElementById("labError");
const tbody = document.getElementById("labsTableBody");
const inchargeSelect = document.getElementById("labIncharge");
const assistantSelect = document.getElementById("labAssistant");

let staffUsers = [];

(async function init() {
  const currentUser = await requireAuth();
  userRoleDisplay.textContent = "HOD";

  if (currentUser.role !== "hod") {
    accessDenied.classList.remove("hidden");
    return;
  }
  navLabs.classList.remove("hidden");
  labsContent.classList.remove("hidden");

  await loadStaffUsers();
  await loadLabs();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);
showFormBtn.addEventListener("click", () => { resetForm(); labForm.classList.remove("hidden"); });
cancelLabBtn.addEventListener("click", () => labForm.classList.add("hidden"));

function resetForm() {
  document.getElementById("labId").value = "";
  document.getElementById("labName").value = "";
  document.getElementById("labDescription").value = "";
  document.getElementById("labStatus").value = "active";
  inchargeSelect.value = "";
  assistantSelect.value = "";
  labError.classList.add("hidden");
}

async function loadStaffUsers() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "in", ["incharge", "assistant"])));
  staffUsers = [];
  snap.forEach((d) => staffUsers.push({ id: d.id, ...d.data() }));

  const options = ['<option value="">-- Select --</option>']
    .concat(staffUsers.map((u) => `<option value="${u.id}">${escapeHtml(u.name)} (${u.role})</option>`))
    .join("");
  inchargeSelect.innerHTML = options;
  assistantSelect.innerHTML = options;
}

async function loadLabs() {
  tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Loading...</td></tr>`;
  const snap = await getDocs(collection(db, "labs"));
  const rows = [];
  snap.forEach((d) => {
    const lab = d.data();
    const incharge = staffUsers.find((u) => u.id === lab.inchargeUid);
    const assistant = staffUsers.find((u) => u.id === lab.assistantUid);
    rows.push(`
      <tr class="border-t">
        <td class="p-3 font-medium">${escapeHtml(lab.name)}</td>
        <td class="p-3">${incharge ? escapeHtml(incharge.name) : "-"}</td>
        <td class="p-3">${assistant ? escapeHtml(assistant.name) : "-"}</td>
        <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${lab.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}">${lab.status}</span></td>
        <td class="p-3"><button data-id="${d.id}" class="editLabBtn text-blue-600 text-sm font-medium">Edit</button></td>
      </tr>
    `);
  });
  tbody.innerHTML = rows.length ? rows.join("") : `<tr><td colspan="5" class="p-4 text-center text-gray-400">No labs yet</td></tr>`;

  document.querySelectorAll(".editLabBtn").forEach((btn) => btn.addEventListener("click", () => openEdit(btn.dataset.id)));
}

async function openEdit(labId) {
  const snap = await getDoc(doc(db, "labs", labId));
  if (!snap.exists()) return;
  const lab = snap.data();

  document.getElementById("labId").value = labId;
  document.getElementById("labName").value = lab.name || "";
  document.getElementById("labDescription").value = lab.description || "";
  document.getElementById("labStatus").value = lab.status || "active";
  inchargeSelect.value = lab.inchargeUid || "";
  assistantSelect.value = lab.assistantUid || "";
  labForm.classList.remove("hidden");
}

saveLabBtn.addEventListener("click", async () => {
  labError.classList.add("hidden");
  const name = document.getElementById("labName").value.trim();
  if (!name) {
    labError.textContent = "Lab Name आवश्यक आहे.";
    labError.classList.remove("hidden");
    return;
  }

  const inchargeUid = inchargeSelect.value || null;
  const assistantUid = assistantSelect.value || null;
  const payload = {
    name,
    description: document.getElementById("labDescription").value.trim(),
    status: document.getElementById("labStatus").value,
    inchargeUid,
    assistantUid,
    updatedAt: new Date().toISOString()
  };

  const labId = document.getElementById("labId").value;
  try {
    let finalLabId = labId;
    if (labId) {
      await updateDoc(doc(db, "labs", labId), payload);
    } else {
      payload.createdAt = payload.updatedAt;
      const newDoc = await addDoc(collection(db, "labs"), payload);
      finalLabId = newDoc.id;
    }

    // assigned staff च्या user profile मध्ये labId sync करणे (एका वेळी एकाच labला assign)
    if (inchargeUid) await updateDoc(doc(db, "users", inchargeUid), { labId: finalLabId });
    if (assistantUid) await updateDoc(doc(db, "users", assistantUid), { labId: finalLabId });

    labForm.classList.add("hidden");
    await loadLabs();
  } catch (err) {
    labError.textContent = "Error: " + err.message;
    labError.classList.remove("hidden");
  }
});
