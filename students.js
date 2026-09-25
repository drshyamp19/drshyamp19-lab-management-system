import { requireAuth, logout, escapeHtml, fmtDate } from "./common.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const userRoleDisplay = document.getElementById("userRoleDisplay");
const navLabs = document.getElementById("navLabs");
const showFormBtn = document.getElementById("showFormBtn");
const studentForm = document.getElementById("studentForm");
const cancelStudentBtn = document.getElementById("cancelStudentBtn");
const saveStudentBtn = document.getElementById("saveStudentBtn");
const studentError = document.getElementById("studentError");
const studentLabWrap = document.getElementById("studentLabWrap");
const studentLabSelect = document.getElementById("studentLab");
const searchBox = document.getElementById("searchBox");
const tbody = document.getElementById("studentsTableBody");
const csvInput = document.getElementById("csvInput");

const profilePanel = document.getElementById("profilePanel");
const closeProfileBtn = document.getElementById("closeProfileBtn");

let currentUser = null;
let labs = [];
let allStudents = [];

(async function init() {
  currentUser = await requireAuth();
  userRoleDisplay.textContent = currentUser.role === "hod" ? "HOD" : currentUser.role;

  if (currentUser.role === "hod") {
    navLabs.classList.remove("hidden");
    studentLabWrap.classList.remove("hidden");
    await loadLabs();
  }
  await loadStudents();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);
showFormBtn.addEventListener("click", () => { resetForm(); studentForm.classList.remove("hidden"); profilePanel.classList.add("hidden"); });
cancelStudentBtn.addEventListener("click", () => studentForm.classList.add("hidden"));
closeProfileBtn.addEventListener("click", () => profilePanel.classList.add("hidden"));
searchBox.addEventListener("input", renderTable);

async function loadLabs() {
  const snap = await getDocs(collection(db, "labs"));
  labs = [];
  snap.forEach((d) => labs.push({ id: d.id, ...d.data() }));
  studentLabSelect.innerHTML = labs.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
}

function resetForm() {
  studentError.classList.add("hidden");
  ["studentId", "studentUid", "studentName", "studentRoll", "studentCourse", "studentYear",
    "studentSem", "studentDivision", "studentBatch", "studentAcadYear", "studentMobile"]
    .forEach((id) => (document.getElementById(id).value = ""));
  document.getElementById("studentStatus").value = "active";
}

async function loadStudents() {
  tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Loading...</td></tr>`;
  const ref = collection(db, "students");
  const q = currentUser.role === "hod" ? ref : query(ref, where("labId", "==", currentUser.labId));
  const snap = await getDocs(q);
  allStudents = [];
  snap.forEach((d) => allStudents.push({ id: d.id, ...d.data() }));
  renderTable();
}

function renderTable() {
  const term = searchBox.value.trim().toLowerCase();
  const filtered = allStudents.filter((s) =>
    !term ||
    s.name.toLowerCase().includes(term) ||
    s.studentUid.toLowerCase().includes(term) ||
    (s.rollNumber || "").toLowerCase().includes(term)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No students found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s) => `
    <tr class="border-t">
      <td class="p-3 font-medium">${escapeHtml(s.name)}</td>
      <td class="p-3">${escapeHtml(s.studentUid)}</td>
      <td class="p-3">${escapeHtml(s.rollNumber || "-")}</td>
      <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}">${s.status}</span></td>
      <td class="p-3 space-x-2">
        <button data-id="${s.id}" class="viewBtn text-gray-600 text-sm font-medium">View</button>
        <button data-id="${s.id}" class="editBtn text-blue-600 text-sm font-medium">Edit</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".editBtn").forEach((b) => b.addEventListener("click", () => openEdit(b.dataset.id)));
  document.querySelectorAll(".viewBtn").forEach((b) => b.addEventListener("click", () => openProfile(b.dataset.id)));
}

async function openEdit(id) {
  const snap = await getDoc(doc(db, "students", id));
  if (!snap.exists()) return;
  const s = snap.data();

  document.getElementById("studentId").value = id;
  document.getElementById("studentUid").value = s.studentUid;
  document.getElementById("studentName").value = s.name;
  document.getElementById("studentRoll").value = s.rollNumber || "";
  document.getElementById("studentCourse").value = s.course || "";
  document.getElementById("studentYear").value = s.year || "";
  document.getElementById("studentSem").value = s.semester || "";
  document.getElementById("studentDivision").value = s.division || "";
  document.getElementById("studentBatch").value = s.batch || "";
  document.getElementById("studentAcadYear").value = s.academicYear || "";
  document.getElementById("studentMobile").value = s.mobile || "";
  document.getElementById("studentStatus").value = s.status || "active";
  if (currentUser.role === "hod") studentLabSelect.value = s.labId;

  studentError.classList.add("hidden");
  profilePanel.classList.add("hidden");
  studentForm.classList.remove("hidden");
}

saveStudentBtn.addEventListener("click", async () => {
  studentError.classList.add("hidden");

  const studentUid = document.getElementById("studentUid").value.trim();
  const name = document.getElementById("studentName").value.trim();
  const labId = currentUser.role === "hod" ? studentLabSelect.value : currentUser.labId;

  if (!studentUid || !name) {
    studentError.textContent = "Student UID आणि Name आवश्यक आहे.";
    studentError.classList.remove("hidden");
    return;
  }
  if (!labId) {
    studentError.textContent = "Lab select करा.";
    studentError.classList.remove("hidden");
    return;
  }

  const studentId = document.getElementById("studentId").value;

  const dupSnap = await getDocs(query(collection(db, "students"), where("studentUid", "==", studentUid)));
  if (dupSnap.docs.some((d) => d.id !== studentId)) {
    studentError.textContent = "हा Student UID आधीच वापरात आहे.";
    studentError.classList.remove("hidden");
    return;
  }

  const payload = {
    studentUid,
    name,
    rollNumber: document.getElementById("studentRoll").value.trim(),
    course: document.getElementById("studentCourse").value.trim(),
    year: document.getElementById("studentYear").value.trim(),
    semester: document.getElementById("studentSem").value.trim(),
    division: document.getElementById("studentDivision").value.trim(),
    batch: document.getElementById("studentBatch").value.trim(),
    academicYear: document.getElementById("studentAcadYear").value.trim(),
    mobile: document.getElementById("studentMobile").value.trim(),
    status: document.getElementById("studentStatus").value,
    labId,
    updatedAt: new Date().toISOString()
  };

  try {
    if (studentId) {
      await updateDoc(doc(db, "students", studentId), payload);
    } else {
      payload.createdAt = payload.updatedAt;
      await addDoc(collection(db, "students"), payload);
    }
    studentForm.classList.add("hidden");
    await loadStudents();
  } catch (err) {
    studentError.textContent = "Error: " + err.message;
    studentError.classList.remove("hidden");
  }
});

// ===== CSV Bulk Import =====
csvInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const labId = currentUser.role === "hod" ? (labs[0] && labs[0].id) : currentUser.labId;
      if (!labId) {
        alert("Import करण्याआधी किमान एक Lab तयार करा / select करा.");
        return;
      }
      let created = 0, skipped = 0;
      const existingUids = new Set(allStudents.map((s) => s.studentUid));

      for (const row of results.data) {
        if (!row.studentUid || !row.name) { skipped++; continue; }
        if (existingUids.has(row.studentUid)) { skipped++; continue; }

        await addDoc(collection(db, "students"), {
          studentUid: row.studentUid.trim(),
          name: row.name.trim(),
          rollNumber: (row.rollNumber || "").trim(),
          course: (row.course || "").trim(),
          year: (row.year || "").trim(),
          semester: (row.semester || "").trim(),
          division: (row.division || "").trim(),
          batch: (row.batch || "").trim(),
          academicYear: (row.academicYear || "").trim(),
          mobile: (row.mobile || "").trim(),
          status: "active",
          labId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingUids.add(row.studentUid);
        created++;
      }

      alert(`Import पूर्ण: ${created} जोडले, ${skipped} skip केले (duplicate/incomplete).`);
      csvInput.value = "";
      await loadStudents();
    }
  });
});

// ===== Profile / History view =====
async function openProfile(studentId) {
  const snap = await getDoc(doc(db, "students", studentId));
  if (!snap.exists()) return;
  const s = snap.data();

  studentForm.classList.add("hidden");
  profilePanel.classList.remove("hidden");
  document.getElementById("profileName").textContent = s.name;
  document.getElementById("profileUid").textContent = "UID: " + s.studentUid;
  document.getElementById("profileIssuedList").innerHTML = `<li class="text-gray-400">Loading...</li>`;
  document.getElementById("profileHistoryBody").innerHTML = "";

  const txSnap = await getDocs(query(collection(db, "transactions"), where("studentId", "==", studentId)));
  const txs = [];
  txSnap.forEach((d) => txs.push({ id: d.id, ...d.data() }));
  txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const issuedList = document.getElementById("profileIssuedList");
  const outstanding = txs.filter((t) => t.type === "out" && t.category === "non-consumable" && t.status === "issued");
  issuedList.innerHTML = outstanding.length
    ? outstanding.map((t) => `<li>• ${escapeHtml(t.componentName)} — ${t.quantity - (t.returnedQty || 0)}</li>`).join("")
    : `<li class="text-gray-400">काहीही issued नाही</li>`;

  document.getElementById("profilePending").textContent = outstanding.length;

  document.getElementById("profileHistoryBody").innerHTML = txs.map((t) => `
    <tr class="border-t">
      <td class="p-1">${fmtDate(t.createdAt)}</td>
      <td class="p-1">${t.type.toUpperCase()}</td>
      <td class="p-1">${escapeHtml(t.componentName)}</td>
      <td class="p-1">${t.quantity}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="p-2 text-gray-400 text-center">No transactions yet</td></tr>`;
}
