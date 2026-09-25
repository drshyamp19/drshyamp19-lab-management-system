import { requireAuth, logout, escapeHtml } from "./common.js";
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const userRoleDisplay = document.getElementById("userRoleDisplay");
const navLabs = document.getElementById("navLabs");
const showFormBtn = document.getElementById("showFormBtn");
const compForm = document.getElementById("compForm");
const cancelCompBtn = document.getElementById("cancelCompBtn");
const saveCompBtn = document.getElementById("saveCompBtn");
const compError = document.getElementById("compError");
const compLabWrap = document.getElementById("compLabWrap");
const compLabSelect = document.getElementById("compLab");
const labFilter = document.getElementById("labFilter");
const categoryFilter = document.getElementById("categoryFilter");
const searchBox = document.getElementById("searchBox");
const tbody = document.getElementById("compTableBody");

let currentUser = null;
let labs = [];
let allComponents = [];

(async function init() {
  currentUser = await requireAuth();
  userRoleDisplay.textContent = currentUser.role === "hod" ? "HOD" : currentUser.role;

  if (currentUser.role === "hod") {
    navLabs.classList.remove("hidden");
    compLabWrap.classList.remove("hidden");
    labFilter.classList.remove("hidden");
    await loadLabs();
  }

  await loadComponents();
})();

document.getElementById("logoutBtn").addEventListener("click", logout);
showFormBtn.addEventListener("click", () => { resetForm(); compForm.classList.remove("hidden"); });
cancelCompBtn.addEventListener("click", () => compForm.classList.add("hidden"));
searchBox.addEventListener("input", renderTable);
categoryFilter.addEventListener("change", renderTable);
labFilter.addEventListener("change", loadComponents);

async function loadLabs() {
  const snap = await getDocs(collection(db, "labs"));
  labs = [];
  snap.forEach((d) => labs.push({ id: d.id, ...d.data() }));

  const options = labs.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
  compLabSelect.innerHTML = options;
  labFilter.innerHTML = `<option value="">All Labs</option>` + options;
}

function resetForm() {
  compError.classList.add("hidden");
  document.getElementById("compId").value = "";
  document.getElementById("compName").value = "";
  document.getElementById("compCode").value = "";
  document.getElementById("compCategory").value = "consumable";
  document.getElementById("compTotal").value = "0";
  document.getElementById("compMinStock").value = "0";
  document.getElementById("compUnit").value = "";
  document.getElementById("compLocation").value = "";
  document.getElementById("compStatus").value = "active";
  document.getElementById("compDescription").value = "";
}

async function loadComponents() {
  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">Loading...</td></tr>`;

  const compRef = collection(db, "components");
  let q;
  if (currentUser.role === "hod") {
    q = labFilter.value ? query(compRef, where("labId", "==", labFilter.value)) : compRef;
  } else {
    q = query(compRef, where("labId", "==", currentUser.labId));
  }

  const snap = await getDocs(q);
  allComponents = [];
  snap.forEach((d) => allComponents.push({ id: d.id, ...d.data() }));
  renderTable();
}

function renderTable() {
  const term = searchBox.value.trim().toLowerCase();
  const cat = categoryFilter.value;

  const filtered = allComponents.filter((c) => {
    const matchesTerm = !term || c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term);
    const matchesCat = !cat || c.category === cat;
    return matchesTerm && matchesCat;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400">No components found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((c) => {
    const lowStock = c.availableQuantity <= c.minStock;
    return `
      <tr class="border-t">
        <td class="p-3 font-medium">${escapeHtml(c.name)}</td>
        <td class="p-3">${escapeHtml(c.code)}</td>
        <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${c.category === "consumable" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}">${c.category}</span></td>
        <td class="p-3">
          ${c.availableQuantity} / ${c.totalQuantity} ${escapeHtml(c.unit || "")}
          ${lowStock ? '<span class="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">LOW STOCK</span>' : ""}
        </td>
        <td class="p-3"><span class="px-2 py-1 rounded-full text-xs ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}">${c.status}</span></td>
        <td class="p-3"><button data-id="${c.id}" class="editBtn text-blue-600 text-sm font-medium">Edit</button></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".editBtn").forEach((btn) => btn.addEventListener("click", () => openEdit(btn.dataset.id)));
}

async function openEdit(id) {
  const snap = await getDoc(doc(db, "components", id));
  if (!snap.exists()) return;
  const c = snap.data();

  document.getElementById("compId").value = id;
  document.getElementById("compName").value = c.name;
  document.getElementById("compCode").value = c.code;
  document.getElementById("compCategory").value = c.category;
  document.getElementById("compTotal").value = c.totalQuantity;
  document.getElementById("compMinStock").value = c.minStock;
  document.getElementById("compUnit").value = c.unit || "";
  document.getElementById("compLocation").value = c.location || "";
  document.getElementById("compStatus").value = c.status || "active";
  document.getElementById("compDescription").value = c.description || "";
  if (currentUser.role === "hod") compLabSelect.value = c.labId;

  compError.classList.add("hidden");
  compForm.classList.remove("hidden");
}

saveCompBtn.addEventListener("click", async () => {
  compError.classList.add("hidden");

  const name = document.getElementById("compName").value.trim();
  const code = document.getElementById("compCode").value.trim();
  const totalQuantity = Number(document.getElementById("compTotal").value);
  const minStock = Number(document.getElementById("compMinStock").value);
  const labId = currentUser.role === "hod" ? compLabSelect.value : currentUser.labId;

  if (!name || !code) {
    compError.textContent = "Name आणि Code आवश्यक आहे.";
    compError.classList.remove("hidden");
    return;
  }
  if (!labId) {
    compError.textContent = "Lab select करा.";
    compError.classList.remove("hidden");
    return;
  }
  if (totalQuantity < 0 || minStock < 0) {
    compError.textContent = "Quantity negative असू शकत नाही.";
    compError.classList.remove("hidden");
    return;
  }

  const compId = document.getElementById("compId").value;

  // Duplicate code within same lab तपासणे
  const dupQuery = query(collection(db, "components"), where("labId", "==", labId), where("code", "==", code));
  const dupSnap = await getDocs(dupQuery);
  const isDuplicate = dupSnap.docs.some((d) => d.id !== compId);
  if (isDuplicate) {
    compError.textContent = "या Lab मध्ये हा Component Code आधीच वापरात आहे.";
    compError.classList.remove("hidden");
    return;
  }

  const basePayload = {
    name,
    code,
    category: document.getElementById("compCategory").value,
    labId,
    totalQuantity,
    minStock,
    unit: document.getElementById("compUnit").value.trim(),
    location: document.getElementById("compLocation").value.trim(),
    status: document.getElementById("compStatus").value,
    description: document.getElementById("compDescription").value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (compId) {
      // Total Quantity बदलल्यास Available Quantity त्याच फरकाने adjust करणे
      const existingSnap = await getDoc(doc(db, "components", compId));
      const existing = existingSnap.data();
      const delta = totalQuantity - existing.totalQuantity;
      const newAvailable = Math.max(0, existing.availableQuantity + delta);
      await updateDoc(doc(db, "components", compId), { ...basePayload, availableQuantity: newAvailable });
    } else {
      basePayload.availableQuantity = totalQuantity;
      basePayload.createdAt = basePayload.updatedAt;
      await addDoc(collection(db, "components"), basePayload);
    }
    compForm.classList.add("hidden");
    await loadComponents();
  } catch (err) {
    compError.textContent = "Error: " + err.message;
    compError.classList.remove("hidden");
  }
});
