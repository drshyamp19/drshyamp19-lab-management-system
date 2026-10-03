import { db, auth } from "./firebase-init.js";
import { collection, getDoc, getDocs, addDoc, writeBatch, doc, serverTimestamp, query, where, increment, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const componentsGrid = document.getElementById("componentsGrid");
const addCompModal = document.getElementById("addCompModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addCompForm = document.getElementById("addCompForm");

const downloadSampleBtn = document.getElementById("downloadSampleBtn");
const uploadCsvBtn = document.getElementById("uploadCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const searchInput = document.getElementById("searchInput");

// Issue Modal Elements
const issueCompModal = document.getElementById("issueCompModal");
const closeIssueModalBtn = document.getElementById("closeIssueModalBtn");
const directIssueForm = document.getElementById("directIssueForm");
const issueStudentSelect = document.getElementById("issueStudentSelect");

let allComponents = [];
let tomSelectInstance = null;
let staffName = "Unknown Staff";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                staffName = userDoc.data().name + " (" + userDoc.data().role + ")";
            }
        } catch (e) {
            console.error("Error fetching staff name:", e);
        }
        loadComponents();
    }
});

async function loadComponents() {
    try {
        const querySnapshot = await getDocs(collection(db, "components"));
        allComponents = [];
        querySnapshot.forEach((doc) => {
            allComponents.push({ id: doc.id, ...doc.data() });
        });
        renderComponents(allComponents);
    } catch (error) {
        console.error("Error loading components:", error);
        componentsGrid.innerHTML = `<p class="text-red-500">Error loading data.</p>`;
    }
}

function renderComponents(compList) {
    componentsGrid.innerHTML = "";
    
    if (compList.length === 0) {
        componentsGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No components found.</p>`;
        return;
    }

    compList.forEach((comp) => {
        const card = document.createElement("div");
        card.className = "bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between";
        
        const badgeColor = comp.category === "CONSUMABLE" ? "bg-orange-100 text-orange-800" : "bg-purple-100 text-purple-800";
        const catText = comp.category === "CONSUMABLE" ? "Consumable" : "Non-Consumable";

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg text-gray-900">${comp.name}</h3>
                    <span class="text-xs px-2 py-1 rounded-full font-semibold ${badgeColor}">${catText}</span>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                    <div class="bg-gray-50 p-2 rounded-lg">
                        <p class="text-xs text-gray-500">Total</p>
                        <p class="font-semibold text-gray-800">${comp.totalQty}</p>
                    </div>
                    <div class="bg-green-50 p-2 rounded-lg">
                        <p class="text-xs text-green-700">Available</p>
                        <p class="font-bold text-green-800">${comp.availableQty}</p>
                    </div>
                </div>
            </div>
            <div class="mt-4 flex gap-2">
                <button onclick="openIssueModal('${comp.id}', '${comp.name}', '${comp.category}', ${comp.availableQty})" class="w-full bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-2 rounded-lg transition duration-200 text-sm">Issue Item</button>
                <button onclick="openReturnModal('${comp.id}', '${comp.name}')" class="w-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white font-bold py-2 rounded-lg transition duration-200 text-sm">Return</button>
            </div>
        `;
        componentsGrid.appendChild(card);
    });
}

// Search Feature
if(searchInput) {
    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allComponents.filter(c => c.name.toLowerCase().includes(term) || c.category.toLowerCase().includes(term));
        renderComponents(filtered);
    });
}

// Global function to open Issue Modal from HTML onclick
window.openIssueModal = async function(id, name, category, availQty) {
    if(availQty <= 0) {
        alert("This item is out of stock!");
        return;
    }
    document.getElementById("issueCompId").value = id;
    document.getElementById("issueCompName").innerText = name;
    document.getElementById("issueCompCategory").value = category;
    document.getElementById("issueCompAvail").value = availQty;
    document.getElementById("issueQty").max = availQty;
    
    issueCompModal.classList.remove("hidden");

    // Load Students into Select
    try {
        const stSnap = await getDocs(collection(db, "students"));
        issueStudentSelect.innerHTML = `<option value="">Select a Student...</option>`;
        stSnap.forEach(doc => {
            const st = doc.data();
            issueStudentSelect.innerHTML += `<option value="${st.uid}|${st.name}">${st.uid} - ${st.name}</option>`;
        });
        
        // Initialize TomSelect if not already initialized
        if(tomSelectInstance) {
            tomSelectInstance.destroy();
        }
        tomSelectInstance = new TomSelect("#issueStudentSelect", { create: false, sortField: { field: "text", direction: "asc" }});
    } catch(e) {
        console.error("Error loading students:", e);
    }
};

closeIssueModalBtn.addEventListener("click", () => {
    issueCompModal.classList.add("hidden");
    directIssueForm.reset();
});

// Handle Direct Issue Submit
directIssueForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const compId = document.getElementById("issueCompId").value;
    const compName = document.getElementById("issueCompName").innerText;
    const compCategory = document.getElementById("issueCompCategory").value;
    const availQty = Number(document.getElementById("issueCompAvail").value);
    
    const studentVal = issueStudentSelect.value;
    const qty = Number(document.getElementById("issueQty").value);
    const purpose = document.getElementById("issuePurpose").value;

    if(!studentVal) return alert("Please select a student.");
    if(qty > availQty) return alert("Quantity exceeds available stock!");

    const [studentUid, studentName] = studentVal.split("|");
    const btn = directIssueForm.querySelector("button[type=submit]");
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        
        // 1. Add Transaction
        const newTxRef = doc(collection(db, "transactions"));
        const newStatus = compCategory === "CONSUMABLE" ? "Consumed" : "Issued";
        batch.set(newTxRef, {
            type: "OUT",
            componentId: compId,
            componentName: compName,
            studentUid: studentUid,
            studentName: studentName,
            quantity: qty,
            purpose: purpose,
            status: newStatus,
            handledBy: staffName,
            date: serverTimestamp()
        });

        // 2. Update Component Stock
        const compRef = doc(db, "components", compId);
        batch.update(compRef, {
            availableQty: availQty - qty
        });

        await batch.commit();
        alert("Component issued successfully!");
        issueCompModal.classList.add("hidden");
        directIssueForm.reset();
        loadComponents(); // Refresh Grid
    } catch (error) {
        console.error("Error issuing:", error);
        alert("Failed to issue component.");
    } finally {
        btn.innerText = "Confirm Issue";
        btn.disabled = false;
    }
});

// Return Component Modal Elements
const returnCompModal = document.getElementById("returnCompModal");
const closeReturnModalBtn = document.getElementById("closeReturnModalBtn");
const returnCompForm = document.getElementById("returnCompForm");
const returnTxSelect = document.getElementById("returnTxSelect");

window.openReturnModal = async function(compId, compName) {
    document.getElementById("returnCompId").value = compId;
    document.getElementById("returnCompName").innerText = compName;
    
    returnTxSelect.innerHTML = `<option value="">Loading transactions...</option>`;
    returnCompModal.classList.remove("hidden");

    try {
        const q = query(collection(db, "transactions"), where("componentId", "==", compId), where("status", "==", "Issued"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            returnTxSelect.innerHTML = `<option value="">No active issues for this item.</option>`;
        } else {
            returnTxSelect.innerHTML = `<option value="">Select Transaction to Return...</option>`;
            snapshot.forEach(doc => {
                const tx = doc.data();
                returnTxSelect.innerHTML += `<option value="${doc.id}|${tx.quantity}">${tx.studentName} (Qty: ${tx.quantity}) - ${new Date(tx.date?.toDate()).toLocaleDateString()}</option>`;
            });
        }
    } catch(e) {
        console.error("Error loading transactions:", e);
        returnTxSelect.innerHTML = `<option value="">Error loading transactions</option>`;
    }
};

closeReturnModalBtn.addEventListener("click", () => {
    returnCompModal.classList.add("hidden");
    returnCompForm.reset();
});

returnTxSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if(!val) {
        document.getElementById("inIssuedQty").value = "";
        document.getElementById("returnGoodQty").value = 0;
        document.getElementById("returnDamagedQty").value = 0;
        document.getElementById("returnMissingQty").value = 0;
        return;
    }
    const qty = val.split("|")[1];
    document.getElementById("inIssuedQty").value = qty;
    document.getElementById("returnGoodQty").value = qty;
    document.getElementById("returnDamagedQty").value = 0;
    document.getElementById("returnMissingQty").value = 0;
});

document.getElementById("btnAllGood")?.addEventListener("click", () => {
    const issuedQty = Number(document.getElementById("inIssuedQty").value);
    if(issuedQty) {
        document.getElementById("returnGoodQty").value = issuedQty;
        document.getElementById("returnDamagedQty").value = 0;
        document.getElementById("returnMissingQty").value = 0;
    }
});

returnCompForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const compId = document.getElementById("returnCompId").value;
    const txVal = returnTxSelect.value;
    
    if(!txVal) return alert("Please select a valid transaction to return.");

    const txId = txVal.split("|")[0];
    const issuedQty = Number(txVal.split("|")[1]);
    
    const goodQty = Number(document.getElementById("returnGoodQty").value) || 0;
    const damagedQty = Number(document.getElementById("returnDamagedQty").value) || 0;
    const missingQty = Number(document.getElementById("returnMissingQty").value) || 0;
    
    if (goodQty + damagedQty + missingQty !== issuedQty) {
        alert(`Total return quantity (${goodQty + damagedQty + missingQty}) must equal issued quantity (${issuedQty}).`);
        return;
    }
    
    const btn = returnCompForm.querySelector("button[type=submit]");
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        
        // 1. Update Transaction
        const txRef = doc(db, "transactions", txId);
        batch.update(txRef, {
            status: "Returned",
            handledBy: staffName,
            returnDate: serverTimestamp(),
            returnDetails: { good: goodQty, damaged: damagedQty, missing: missingQty }
        });

        // 2. Update Component Stock
        const compRef = doc(db, "components", compId);
        batch.update(compRef, {
            availableQty: increment(goodQty),
            totalQty: increment(-(damagedQty + missingQty))
        });

        await batch.commit();
        alert("Component returned successfully!");
        returnCompModal.classList.add("hidden");
        returnCompForm.reset();
        loadComponents(); // Refresh Grid
    } catch (error) {
        console.error("Error returning:", error);
        alert("Failed to return component.");
    } finally {
        btn.innerText = "Confirm Return";
        btn.disabled = false;
    }
});

// Add Component Logic
showAddModalBtn.addEventListener("click", () => addCompModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addCompModal.classList.add("hidden"));

addCompForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = addCompForm.querySelector("button[type=submit]");
    btn.innerText = "Saving...";
    
    try {
        const qty = Number(document.getElementById("compQty").value);
        await addDoc(collection(db, "components"), {
            name: document.getElementById("compName").value,
            category: document.getElementById("compCategory").value,
            totalQty: qty,
            availableQty: qty,
            createdAt: new Date()
        });
        
        addCompModal.classList.add("hidden");
        addCompForm.reset();
        btn.innerText = "Save Item";
        loadComponents();
    } catch (error) {
        console.error("Error adding component:", error);
        alert("Failed to add component.");
        btn.innerText = "Save Item";
    }
});

// CSV Download Sample
downloadSampleBtn.addEventListener("click", () => {
    const csvContent = "Name,Category,TotalQuantity\nMultimeter,NON_CONSUMABLE,10\nResistors,CONSUMABLE,500";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Component_Sample.csv';
    a.click();
});

// CSV Upload
uploadCsvBtn.addEventListener("click", () => csvFileInput.click());

csvFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        const rows = text.split("\n").filter(row => row.trim().length > 0).slice(1); 
        if (rows.length === 0) return alert("File is empty or invalid format.");
        
        uploadCsvBtn.innerText = "Uploading...";
        let count = 0;
        
        try {
            for (let row of rows) {
                const cols = row.split(",");
                if (cols.length >= 3) {
                    const qty = Number(cols[2].trim());
                    let category = cols[1].trim().toUpperCase();
                    if(category !== "CONSUMABLE" && category !== "NON_CONSUMABLE") category = "NON_CONSUMABLE";

                    await addDoc(collection(db, "components"), {
                        name: cols[0].trim(),
                        category: category,
                        totalQty: qty,
                        availableQty: qty,
                        createdAt: new Date()
                    });
                    count++;
                }
            }
            alert(`${count} Components uploaded successfully!`);
            csvFileInput.value = ""; 
            uploadCsvBtn.innerText = "⬆ Upload CSV";
            loadComponents();
        } catch (error) {
            console.error(error);
            alert("Error uploading data.");
            uploadCsvBtn.innerText = "⬆ Upload CSV";
        }
    };
    reader.readAsText(file);
});
