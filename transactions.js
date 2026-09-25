import { requireAuth, logout, escapeHtml, nowIso } from "./common.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, query, where, increment
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const userRoleDisplay = document.getElementById("userRoleDisplay");
const navLabs = document.getElementById("navLabs");
const labPickerWrap = document.getElementById("labPickerWrap");
const labPicker = document.getElementById("labPicker");

const tabOutBtn = document.getElementById("tabOutBtn");
const tabInBtn = document.getElementById("tabInBtn");
const outPanel = document.getElementById("outPanel");
const inPanel = document.getElementById("inPanel");

let currentUser = null;
let activeLabId = null;
let studentsCache = [];
let componentsCache = [];

let selectedStudent = null;
let selectedComponent = null;
let selectedOutTx = null;

(async function init() {
  currentUser = await requireAuth();
  userRoleDisplay.textContent = currentUser.role === "hod" ? "HOD" : currentUser.role;

  if (currentUser.role === "hod") {
    navLabs.classList.remove("hidden");
    labPickerWrap.classList.remove("hidden");
    const snap = await getDocs(collection(db, "labs"));
    const labs = [];
    snap.forEach((d) => labs.push({ id: d.id, ...d.data() }));
    labPicker.innerHTML = labs.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
    activeLabId = labs[0] ? labs[0].id : null;
    labPicker.addEventListener("change", () => { activeLabId = labPicker.value; loadCaches(); });
  } else {
    activeLabId = currentUser.labId;
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);
  await loadCaches();
})();

async function loadCaches() {
  if (!activeLabId) return;
  const stuSnap = await getDocs(query(collection(db, "students"), where("labId", "==", activeLabId)));
  studentsCache = [];
  stuSnap.forEach((d) => studentsCache.push({ id: d.id, ...d.data() }));

  const compSnap = await getDocs(query(collection(db, "components"), where("labId", "==", activeLabId)));
  componentsCache = [];
  compSnap.forEach((d) => componentsCache.push({ id: d.id, ...d.data() }));
}

// ===== Tabs =====
tabOutBtn.addEventListener("click", () => switchTab("out"));
tabInBtn.addEventListener("click", () => switchTab("in"));
function switchTab(tab) {
  const isOut = tab === "out";
  outPanel.classList.toggle("hidden", !isOut);
  inPanel.classList.toggle("hidden", isOut);
  tabOutBtn.className = `px-4 py-2 rounded-lg font-medium ${isOut ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`;
  tabInBtn.className = `px-4 py-2 rounded-lg font-medium ${!isOut ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700"}`;
}

// ===== OUT: Student search =====
const outStudentSearch = document.getElementById("outStudentSearch");
const outStudentResults = document.getElementById("outStudentResults");
const outStudentSelected = document.getElementById("outStudentSelected");

outStudentSearch.addEventListener("input", () => {
  const term = outStudentSearch.value.trim().toLowerCase();
  if (!term) { outStudentResults.classList.add("hidden"); return; }
  const matches = studentsCache.filter((s) =>
    s.name.toLowerCase().includes(term) || s.studentUid.toLowerCase().includes(term) || (s.rollNumber || "").toLowerCase().includes(term)
  ).slice(0, 8);

  outStudentResults.innerHTML = matches.map((s) =>
    `<div class="p-2 hover:bg-gray-50 cursor-pointer text-sm" data-id="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.studentUid)} (${escapeHtml(s.rollNumber || "")})</div>`
  ).join("") || `<div class="p-2 text-gray-400 text-sm">No match</div>`;
  outStudentResults.classList.remove("hidden");

  outStudentResults.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => {
    selectedStudent = studentsCache.find((s) => s.id === el.dataset.id);
    outStudentSelected.textContent = `Selected: ${selectedStudent.name} (${selectedStudent.studentUid})`;
    outStudentSelected.classList.remove("hidden");
    outStudentResults.classList.add("hidden");
    outStudentSearch.value = "";
  }));
});

// ===== OUT: Component search =====
const outCompSearch = document.getElementById("outCompSearch");
const outCompResults = document.getElementById("outCompResults");
const outCompSelected = document.getElementById("outCompSelected");

outCompSearch.addEventListener("input", () => {
  const term = outCompSearch.value.trim().toLowerCase();
  if (!term) { outCompResults.classList.add("hidden"); return; }
  const matches = componentsCache.filter((c) =>
    c.status === "active" && (c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term))
  ).slice(0, 8);

  outCompResults.innerHTML = matches.map((c) =>
    `<div class="p-2 hover:bg-gray-50 cursor-pointer text-sm" data-id="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.code)}) — Avail: ${c.availableQuantity} ${escapeHtml(c.unit || "")}</div>`
  ).join("") || `<div class="p-2 text-gray-400 text-sm">No match</div>`;
  outCompResults.classList.remove("hidden");

  outCompResults.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => {
    selectedComponent = componentsCache.find((c) => c.id === el.dataset.id);
    outCompSelected.textContent = `Selected: ${selectedComponent.name} — Available: ${selectedComponent.availableQuantity} ${selectedComponent.unit || ""}`;
    outCompSelected.classList.remove("hidden");
    outCompResults.classList.add("hidden");
    outCompSearch.value = "";
  }));
});

// ===== OUT: Submit =====
const outError = document.getElementById("outError");
const outSuccess = document.getElementById("outSuccess");

document.getElementById("submitOutBtn").addEventListener("click", async () => {
  outError.classList.add("hidden");
  outSuccess.classList.add("hidden");

  const qty = Number(document.getElementById("outQty").value);
  const purpose = document.getElementById("outPurpose").value.trim();
  const remarks = document.getElementById("outRemarks").value.trim();

  if (!selectedStudent) return showOutError("Student select करा.");
  if (!selectedComponent) return showOutError("Component select करा.");
  if (!qty || qty <= 0) return showOutError("वैध Quantity टाका.");

  try {
    // ताजी stock value पुन्हा तपासणे (कोणी दुसऱ्याने बदलली असेल तर)
    const freshSnap = await getDoc(doc(db, "components", selectedComponent.id));
    const fresh = freshSnap.data();

    if (qty > fresh.availableQuantity) {
      return showOutError(`Available stock फक्त ${fresh.availableQuantity} आहे.`);
    }

    await updateDoc(doc(db, "components", selectedComponent.id), {
      availableQuantity: increment(-qty)
    });

    await addDoc(collection(db, "transactions"), {
      type: "out",
      studentId: selectedStudent.id,
      studentUid: selectedStudent.studentUid,
      studentName: selectedStudent.name,
      rollNumber: selectedStudent.rollNumber || "",
      labId: activeLabId,
      componentId: selectedComponent.id,
      componentCode: fresh.code,
      componentName: fresh.name,
      category: fresh.category,
      quantity: qty,
      returnedQty: 0,
      purpose,
      remarks,
      issuedByUid: currentUser.uid,
      issuedByName: currentUser.name,
      status: fresh.category === "non-consumable" ? "issued" : "completed",
      createdAt: nowIso()
    });

    outSuccess.textContent = "OUT transaction यशस्वी!";
    outSuccess.classList.remove("hidden");
    resetOutForm();
    await loadCaches();
  } catch (err) {
    showOutError("Error: " + err.message);
  }
});

function showOutError(msg) {
  outError.textContent = msg;
  outError.classList.remove("hidden");
}

function resetOutForm() {
  selectedStudent = null;
  selectedComponent = null;
  outStudentSelected.classList.add("hidden");
  outCompSelected.classList.add("hidden");
  document.getElementById("outQty").value = "";
  document.getElementById("outPurpose").value = "";
  document.getElementById("outRemarks").value = "";
}

// ===== IN: search issued items =====
const inSearch = document.getElementById("inSearch");
const inResults = document.getElementById("inResults");
const inFormWrap = document.getElementById("inFormWrap");
const inSelectedInfo = document.getElementById("inSelectedInfo");
const inError = document.getElementById("inError");
const inSuccess = document.getElementById("inSuccess");

inSearch.addEventListener("input", async () => {
  const term = inSearch.value.trim().toLowerCase();
  inFormWrap.classList.add("hidden");
  if (!term) { inResults.innerHTML = ""; return; }

  const snap = await getDocs(query(
    collection(db, "transactions"),
    where("labId", "==", activeLabId),
    where("status", "==", "issued")
  ));

  const matches = [];
  snap.forEach((d) => {
    const t = { id: d.id, ...d.data() };
    const hay = `${t.studentName} ${t.studentUid} ${t.componentName} ${t.componentCode}`.toLowerCase();
    if (hay.includes(term)) matches.push(t);
  });

  inResults.innerHTML = matches.length ? matches.map((t) => `
    <div class="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer text-sm" data-id="${t.id}">
      <span class="font-medium">${escapeHtml(t.componentName)}</span> — ${escapeHtml(t.studentName)} (${escapeHtml(t.studentUid)})
      <br><span class="text-gray-500 text-xs">Outstanding: ${t.quantity - (t.returnedQty || 0)}</span>
    </div>
  `).join("") : `<p class="text-gray-400 text-sm">काही जुळणारं issued item सापडलं नाही.</p>`;

  inResults.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => {
    selectedOutTx = matches.find((t) => t.id === el.dataset.id);
    const remaining = selectedOutTx.quantity - (selectedOutTx.returnedQty || 0);
    inSelectedInfo.textContent = `${selectedOutTx.componentName} — ${selectedOutTx.studentName} | Outstanding: ${remaining}`;
    document.getElementById("inQty").value = remaining;
    document.getElementById("inQty").max = remaining;
    inFormWrap.classList.remove("hidden");
    inError.classList.add("hidden");
    inSuccess.classList.add("hidden");
  }));
});

document.getElementById("submitInBtn").addEventListener("click", async () => {
  inError.classList.add("hidden");
  inSuccess.classList.add("hidden");

  if (!selectedOutTx) return;
  const qty = Number(document.getElementById("inQty").value);
  const condition = document.getElementById("inCondition").value;
  const remarks = document.getElementById("inRemarks").value.trim();
  const remaining = selectedOutTx.quantity - (selectedOutTx.returnedQty || 0);

  if (!qty || qty <= 0) { inError.textContent = "वैध Quantity टाका."; inError.classList.remove("hidden"); return; }
  if (qty > remaining) { inError.textContent = `जास्तीत जास्त ${remaining} return करता येईल.`; inError.classList.remove("hidden"); return; }

  try {
    await addDoc(collection(db, "transactions"), {
      type: "in",
      outTransactionId: selectedOutTx.id,
      studentId: selectedOutTx.studentId,
      studentUid: selectedOutTx.studentUid,
      studentName: selectedOutTx.studentName,
      labId: activeLabId,
      componentId: selectedOutTx.componentId,
      componentCode: selectedOutTx.componentCode,
      componentName: selectedOutTx.componentName,
      category: selectedOutTx.category,
      quantity: qty,
      condition,
      remarks,
      receivedByUid: currentUser.uid,
      receivedByName: currentUser.name,
      status: "completed",
      createdAt: nowIso()
    });

    const newReturnedQty = (selectedOutTx.returnedQty || 0) + qty;
    await updateDoc(doc(db, "transactions", selectedOutTx.id), {
      returnedQty: newReturnedQty,
      status: newReturnedQty >= selectedOutTx.quantity ? "returned" : "issued"
    });

    // Good असेल तरच stock मध्ये परत जमा होते; Damaged/Missing वेगळं track होतं
    if (condition === "good") {
      await updateDoc(doc(db, "components", selectedOutTx.componentId), { availableQuantity: increment(qty) });
    } else if (condition === "damaged") {
      await updateDoc(doc(db, "components", selectedOutTx.componentId), { damagedQty: increment(qty) });
    } else {
      await updateDoc(doc(db, "components", selectedOutTx.componentId), { missingQty: increment(qty) });
    }

    inSuccess.textContent = "IN transaction यशस्वी!";
    inSuccess.classList.remove("hidden");
    inFormWrap.classList.add("hidden");
    inSearch.value = "";
    inResults.innerHTML = "";
    selectedOutTx = null;
    await loadCaches();
  } catch (err) {
    inError.textContent = "Error: " + err.message;
    inError.classList.remove("hidden");
  }
});
