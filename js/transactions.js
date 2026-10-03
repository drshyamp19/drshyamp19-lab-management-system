import { db, auth } from "./firebase-init.js";
import { collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const tabOut = document.getElementById("tabOut");
const tabIn = document.getElementById("tabIn");
const formOut = document.getElementById("formOut");
const formIn = document.getElementById("formIn");

const outStudent = document.getElementById("outStudent");
const outComponent = document.getElementById("outComponent");
const inTransaction = document.getElementById("inTransaction");

let componentsData = [];
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    else {
        currentUser = user;
        loadDropdowns();
    }
});

// Tab switching
tabOut.addEventListener("click", () => {
    formOut.classList.remove("hidden"); formIn.classList.add("hidden");
    tabOut.className = "font-bold text-blue-600 border-b-2 border-blue-600 px-2 py-1";
    tabIn.className = "font-bold text-gray-500 hover:text-gray-700 px-2 py-1";
});
tabIn.addEventListener("click", () => {
    formIn.classList.remove("hidden"); formOut.classList.add("hidden");
    tabIn.className = "font-bold text-green-600 border-b-2 border-green-600 px-2 py-1";
    tabOut.className = "font-bold text-gray-500 hover:text-gray-700 px-2 py-1";
});

async function loadDropdowns() {
    try {
        // Load Students
        const stuSnap = await getDocs(collection(db, "students"));
        outStudent.innerHTML = `<option value="">-- Select Student --</option>`;
        stuSnap.forEach(doc => {
            const s = doc.data();
            outStudent.innerHTML += `<option value="${doc.id}">${s.name} (${s.uid})</option>`;
        });

        // Load Components
        const compSnap = await getDocs(collection(db, "components"));
        componentsData = [];
        outComponent.innerHTML = `<option value="">-- Select Component --</option>`;
        compSnap.forEach(doc => {
            const c = doc.data();
            componentsData.push({id: doc.id, ...c});
            if (c.availableQty > 0) {
                outComponent.innerHTML += `<option value="${doc.id}">${c.name} (Avail: ${c.availableQty})</option>`;
            }
        });

        // Load Active Issues for Return
        const txQuery = query(collection(db, "transactions"), where("type", "==", "OUT"), where("status", "==", "Issued"));
        const txSnap = await getDocs(txQuery);
        inTransaction.innerHTML = `<option value="">-- Select Issue to Return --</option>`;
        txSnap.forEach(doc => {
            const tx = doc.data();
            inTransaction.innerHTML += `<option value="${doc.id}">${tx.studentName} - ${tx.componentName} (Qty: ${tx.quantity})</option>`;
        });

    } catch (e) { console.error("Error loading dropdowns", e); }
}

document.getElementById("issueForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.innerText = "Processing...";
    
    const stuId = outStudent.value;
    const compId = outComponent.value;
    const qty = Number(document.getElementById("outQty").value);
    const purpose = document.getElementById("outPurpose").value;
    
    const comp = componentsData.find(c => c.id === compId);
    const stuName = outStudent.options[outStudent.selectedIndex].text.split(" (")[0];

    if (qty > comp.availableQty) {
        alert("Not enough stock!");
        btn.innerText = "Confirm OUT";
        return;
    }

    try {
        const batch = writeBatch(db);
        
        // 1. Create Transaction
        const txRef = doc(collection(db, "transactions"));
        batch.set(txRef, {
            type: "OUT",
            studentId: stuId,
            studentName: stuName,
            componentId: compId,
            componentName: comp.name,
            category: comp.category,
            quantity: qty,
            purpose: purpose,
            dateTime: serverTimestamp(),
            status: comp.category === "NON_CONSUMABLE" ? "Issued" : "Consumed",
            issuedBy: currentUser.uid
        });

        // 2. Decrease Stock
        const compRef = doc(db, "components", compId);
        batch.update(compRef, { availableQty: comp.availableQty - qty });

        await batch.commit();
        alert("Successfully Issued!");
        e.target.reset();
        loadDropdowns(); // refresh data
    } catch (err) {
        alert("Error issuing component");
        console.error(err);
    }
    btn.innerText = "Confirm OUT";
});

document.getElementById("returnForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.innerText = "Processing...";

    const txId = inTransaction.value;
    const condition = document.getElementById("inCondition").value;

    try {
        // Fetch the original OUT transaction
        const txDoc = await getDocs(query(collection(db, "transactions"))); // simplified for vanilla JS without complex imports
        let originalTx = null;
        txDoc.forEach(d => { if(d.id === txId) originalTx = d.data(); });

        if(!originalTx) throw new Error("Transaction not found");

        const batch = writeBatch(db);

        // 1. Mark original as Returned
        batch.update(doc(db, "transactions", txId), { status: "Returned" });

        // 2. Create IN transaction
        const newTxRef = doc(collection(db, "transactions"));
        batch.set(newTxRef, {
            type: "IN",
            studentName: originalTx.studentName,
            componentName: originalTx.componentName,
            quantity: originalTx.quantity,
            condition: condition,
            dateTime: serverTimestamp(),
            receivedBy: currentUser.uid
        });

        // 3. Increase Stock (ONLY if Good condition)
        if (condition === "Good") {
            const comp = componentsData.find(c => c.id === originalTx.componentId);
            if (comp) {
                batch.update(doc(db, "components", originalTx.componentId), { 
                    availableQty: comp.availableQty + originalTx.quantity 
                });
            }
        }

        await batch.commit();
        alert("Successfully Returned!");
        e.target.reset();
        loadDropdowns();
    } catch (err) {
        alert("Error returning component");
        console.error(err);
    }
    btn.innerText = "Confirm IN";
});
