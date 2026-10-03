import { db, auth } from "./firebase-init.js";
import { collection, getDocs, setDoc, doc, writeBatch, serverTimestamp, getDoc, query, where, increment, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const studentsTableBody = document.getElementById("studentsTableBody");
const addStudentModal = document.getElementById("addStudentModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addStudentForm = document.getElementById("addStudentForm");

const downloadSampleBtn = document.getElementById("downloadSampleBtn");
const uploadCsvBtn = document.getElementById("uploadCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const searchInput = document.getElementById("searchInput");

// Direct Issue Elements
const issueCompModal = document.getElementById("issueCompModal");
const closeIssueModalBtn = document.getElementById("closeIssueModalBtn");
const directIssueForm = document.getElementById("directIssueForm");
const issueCompSelect = document.getElementById("issueCompSelect");

let allStudents = [];
let allComponentsCache = [];
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
        loadStudents();
    }
});

async function loadStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        allStudents = [];
        querySnapshot.forEach((doc) => {
            allStudents.push(doc.data());
        });
        renderStudents(allStudents);
    } catch (error) {
        console.error("Error loading students:", error);
        studentsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading data.</td></tr>`;
    }
}

function renderStudents(list) {
    studentsTableBody.innerHTML = "";
    if (list.length === 0) {
        studentsTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No students found. Add some!</td></tr>`;
        return;
    }

    list.forEach((st) => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-gray-100 hover:bg-gray-50 transition";
        tr.innerHTML = `
            <td class="p-4 text-gray-800 font-medium">${st.uid}</td>
            <td class="p-4 text-gray-600 cursor-pointer hover:underline text-blue-600" onclick="openStudentHistory('${st.uid}', '${st.name.replace(/'/g, "\\'")}')">${st.name}</td>
            <td class="p-4 text-gray-600">${st.course}</td>
            <td class="p-4 text-right">
                <button onclick="openIssueModal('${st.uid}', '${st.name.replace(/'/g, "\\'")}')" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-md text-xs font-bold transition mr-1">Issue Item</button>
                <button onclick="openReturnModal('${st.uid}', '${st.name.replace(/'/g, "\\'")}')" class="bg-green-50 text-green-600 hover:bg-green-600 hover:text-white px-3 py-1 rounded-md text-xs font-bold transition">Return</button>
            </td>
        `;
        studentsTableBody.appendChild(tr);
    });
}

// Search Functionality
if(searchInput) {
    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allStudents.filter(s => s.name.toLowerCase().includes(term) || s.uid.toLowerCase().includes(term));
        renderStudents(filtered);
    });
}

// Direct Issue Functionality
window.openIssueModal = async function(uid, name) {
    document.getElementById("issueStudentUid").value = uid;
    document.getElementById("issueStudentName").innerText = name;
    
    issueCompModal.classList.remove("hidden");

    try {
        const compSnap = await getDocs(collection(db, "components"));
        issueCompSelect.innerHTML = `<option value="">Select a Component...</option>`;
        allComponentsCache = [];
        
        compSnap.forEach(doc => {
            const comp = { id: doc.id, ...doc.data() };
            allComponentsCache.push(comp);
            if(comp.availableQty > 0) {
                issueCompSelect.innerHTML += `<option value="${comp.id}">${comp.name} (Avail: ${comp.availableQty})</option>`;
            }
        });
        
        if(tomSelectInstance) {
            tomSelectInstance.destroy();
        }
        tomSelectInstance = new TomSelect("#issueCompSelect", { create: false, sortField: { field: "text", direction: "asc" }});
    } catch(e) {
        console.error("Error loading components:", e);
    }
};

closeIssueModalBtn.addEventListener("click", () => {
    issueCompModal.classList.add("hidden");
    directIssueForm.reset();
});

directIssueForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentUid = document.getElementById("issueStudentUid").value;
    const studentName = document.getElementById("issueStudentName").innerText;
    
    const compId = issueCompSelect.value;
    const qty = Number(document.getElementById("issueQty").value);
    const purpose = document.getElementById("issuePurpose").value;

    if(!compId) return alert("Please select a component.");

    // Find component in cache to check qty and category
    const selectedComp = allComponentsCache.find(c => c.id === compId);
    if(qty > selectedComp.availableQty) return alert("Quantity exceeds available stock!");

    const btn = directIssueForm.querySelector("button[type=submit]");
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const batch = writeBatch(db);
        
        const newTxRef = doc(collection(db, "transactions"));
        const newStatus = selectedComp.category === "CONSUMABLE" ? "Consumed" : "Issued";
        batch.set(newTxRef, {
            type: "OUT",
            componentId: selectedComp.id,
            componentName: selectedComp.name,
            studentUid: studentUid,
            studentName: studentName,
            quantity: qty,
            purpose: purpose,
            status: newStatus,
            handledBy: staffName,
            date: serverTimestamp()
        });

        const compRef = doc(db, "components", selectedComp.id);
        batch.update(compRef, {
            availableQty: selectedComp.availableQty - qty
        });

        await batch.commit();
        alert("Component issued successfully!");
        issueCompModal.classList.add("hidden");
        directIssueForm.reset();
    } catch (error) {
        console.error("Error issuing:", error);
        alert("Failed to issue component.");
    } finally {
        btn.innerText = "Confirm Issue";
        btn.disabled = false;
    }
});

// Return Modal Elements
const returnCompModal = document.getElementById("returnCompModal");
const closeReturnModalBtn = document.getElementById("closeReturnModalBtn");
const returnCompForm = document.getElementById("returnCompForm");
const returnTxSelect = document.getElementById("returnTxSelect");

window.openReturnModal = async function(studentUid, studentName) {
    document.getElementById("returnStudentUid").value = studentUid;
    document.getElementById("returnStudentName").innerText = studentName;
    
    returnTxSelect.innerHTML = `<option value="">Loading transactions...</option>`;
    returnCompModal.classList.remove("hidden");

    try {
        const q = query(collection(db, "transactions"), where("studentUid", "==", studentUid), where("status", "==", "Issued"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            returnTxSelect.innerHTML = `<option value="">No active issues for this student.</option>`;
        } else {
            returnTxSelect.innerHTML = `<option value="">Select Transaction to Return...</option>`;
            snapshot.forEach(doc => {
                const tx = doc.data();
                returnTxSelect.innerHTML += `<option value="${doc.id}|${tx.componentId}|${tx.quantity}">${tx.componentName} (Qty: ${tx.quantity}) - ${new Date(tx.date?.toDate()).toLocaleDateString()}</option>`;
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
    const qty = val.split("|")[2]; // value is doc.id|compId|qty
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

['returnGoodQty', 'returnDamagedQty'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        const issuedQty = Number(document.getElementById("inIssuedQty").value) || 0;
        const good = Number(document.getElementById("returnGoodQty").value) || 0;
        const damaged = Number(document.getElementById("returnDamagedQty").value) || 0;
        document.getElementById("returnMissingQty").value = Math.max(0, issuedQty - (good + damaged));
    });
});

returnCompForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentUid = document.getElementById("returnStudentUid").value;
    const txVal = returnTxSelect.value;
    
    if(!txVal) return alert("Please select a valid transaction to return.");

    const [txId, compId, txQty] = txVal.split("|");
    const issuedQty = Number(txQty);
    
    const goodQty = Number(document.getElementById("returnGoodQty").value) || 0;
    const damagedQty = Number(document.getElementById("returnDamagedQty").value) || 0;
    const missingQty = Number(document.getElementById("returnMissingQty").value) || 0;
    const totalReturned = goodQty + damagedQty + missingQty;
    
    if (totalReturned > issuedQty || totalReturned === 0) {
        alert(`Total return quantity (${totalReturned}) must be between 1 and ${issuedQty}.`);
        return;
    }
    
    const btn = returnCompForm.querySelector("button[type=submit]");
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        const txDoc = await getDoc(doc(db, "transactions", txId)); 
        if(!txDoc.exists()) throw new Error("Transaction not found");
        const originalTx = txDoc.data();

        const batch = writeBatch(db);
        
        if (totalReturned === issuedQty) {
            // 1. Update Transaction
            const txRef = doc(db, "transactions", txId);
            batch.update(txRef, {
                status: "Returned",
                handledBy: staffName,
                returnDate: serverTimestamp(),
                returnDetails: { good: goodQty, damaged: damagedQty, missing: missingQty }
            });
        } else {
            // Partial Return
            batch.update(doc(db, "transactions", txId), {
                quantity: issuedQty - totalReturned
            });
            const newTxRef = doc(collection(db, "transactions"));
            batch.set(newTxRef, {
                ...originalTx,
                quantity: totalReturned,
                status: "Returned",
                handledBy: staffName,
                returnDate: serverTimestamp(),
                returnDetails: { good: goodQty, damaged: damagedQty, missing: missingQty }
            });
        }

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
    } catch (error) {
        console.error("Error returning:", error);
        alert("Failed to return component.");
    } finally {
        btn.innerText = "Confirm Return";
        btn.disabled = false;
    }
});


// Single Add Student
showAddModalBtn.addEventListener("click", () => addStudentModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addStudentModal.classList.add("hidden"));

addStudentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = addStudentForm.querySelector("button[type=submit]");
    btn.innerText = "Saving...";
    
    try {
        const uid = document.getElementById("stuUid").value.trim().toUpperCase();
        await setDoc(doc(db, "students", uid), {
            uid: uid,
            name: document.getElementById("stuName").value,
            course: document.getElementById("stuCourse").value,
            createdAt: new Date()
        });
        
        addStudentModal.classList.add("hidden");
        addStudentForm.reset();
        btn.innerText = "Save";
        loadStudents();
    } catch (error) {
        console.error("Error adding student:", error);
        alert("Failed to add student.");
        btn.innerText = "Save";
    }
});

// CSV Download Sample
downloadSampleBtn.addEventListener("click", () => {
    const csvContent = "UID,Name,Course\nSTU001,Rahul Patil,B.Tech\nSTU002,Sneha Deshmukh,Diploma";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Student_Sample.csv';
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
                if (cols.length >= 2) {
                    const uid = cols[0].trim().toUpperCase();
                    await setDoc(doc(db, "students", uid), {
                        uid: uid,
                        name: cols[1].trim(),
                        course: cols[2] ? cols[2].trim() : "N/A",
                        createdAt: new Date()
                    });
                    count++;
                }
            }
            alert(`${count} Students uploaded successfully!`);
            csvFileInput.value = "";
            uploadCsvBtn.innerText = "⬆ Upload CSV";
            loadStudents();
        } catch (error) {
            console.error(error);
            alert("Error uploading data.");
            uploadCsvBtn.innerText = "⬆ Upload CSV";
        }
    };
    reader.readAsText(file);
});

// Student History Logic
const studentHistoryModal = document.getElementById("studentHistoryModal");
const closeStudentHistoryBtn = document.getElementById("closeStudentHistoryBtn");
const studentHistoryTableBody = document.getElementById("studentHistoryTableBody");

window.openStudentHistory = async function(uid, name) {
    document.getElementById("historyStudentName").innerText = name;
    studentHistoryModal.classList.remove("hidden");
    studentHistoryTableBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-500">Loading history...</td></tr>`;

    try {
        const q = query(collection(db, "transactions"), where("studentUid", "==", uid));
        const snapshot = await getDocs(q);
        
        let txs = [];
        snapshot.forEach(doc => txs.push({id: doc.id, ...doc.data()}));
        txs.sort((a, b) => b.date?.toMillis() - a.date?.toMillis());
        
        if(txs.length === 0) {
            studentHistoryTableBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-500">No history found.</td></tr>`;
            return;
        }

        studentHistoryTableBody.innerHTML = "";
        txs.forEach(tx => {
            const dateStr = tx.date ? new Date(tx.date.toDate()).toLocaleDateString() : (tx.dateTime ? new Date(tx.dateTime.toDate()).toLocaleDateString() : 'N/A');
            const statusClass = tx.status === "Returned" ? "text-green-600" : (tx.status === "Consumed" ? "text-red-600" : "text-orange-600");
            studentHistoryTableBody.innerHTML += `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-3 text-sm text-gray-600">${dateStr}</td>
                    <td class="p-3 text-sm text-gray-800 font-medium">${tx.componentName}</td>
                    <td class="p-3 text-sm text-gray-600">${tx.quantity}</td>
                    <td class="p-3 text-sm font-semibold ${statusClass}">${tx.status}</td>
                </tr>
            `;
        });
    } catch(e) {
        console.error("Error loading history:", e);
        studentHistoryTableBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-red-500">Error loading history</td></tr>`;
    }
}

closeStudentHistoryBtn?.addEventListener("click", () => {
    studentHistoryModal.classList.add("hidden");
});
