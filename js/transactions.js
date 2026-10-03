import { db, auth } from "./firebase-init.js";
import { collection, getDocs, doc, updateDoc, writeBatch, serverTimestamp, query, where, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// Searchable Dropdown Instances
let tsStudent, tsComponent, tsTransaction;

let staffName = "Unknown Staff";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        currentUser = user;
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                staffName = userDoc.data().name + " (" + userDoc.data().role + ")";
            }
        } catch (e) {
            console.error("Error fetching staff name:", e);
        }
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
        // Clear previous TomSelect instances if reloading data
        if(tsStudent) { tsStudent.destroy(); }
        if(tsComponent) { tsComponent.destroy(); }
        if(tsTransaction) { tsTransaction.destroy(); }

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

        // Load Active Issues for Return (Fixed Index Issue)
        const txQuery = query(collection(db, "transactions"), where("type", "==", "OUT"));
        const txSnap = await getDocs(txQuery);
        inTransaction.innerHTML = `<option value="">-- Select Issue to Return --</option>`;
        txSnap.forEach(doc => {
            const tx = doc.data();
            if(tx.status === "Issued" || tx.status === "Consumed") {
                inTransaction.innerHTML += `<option value="${doc.id}|${tx.quantity}">${tx.studentName} - ${tx.componentName} (Qty: ${tx.quantity})</option>`;
            }
        });

        // Initialize TomSelect for Searchable Dropdowns
        tsStudent = new TomSelect("#outStudent", { maxOptions: 1000, create: false });
        tsComponent = new TomSelect("#outComponent", { maxOptions: 1000, create: false });
        tsTransaction = new TomSelect("#inTransaction", { 
            maxOptions: 1000, 
            create: false,
            onChange: function(value) {
                if(!value) {
                    document.getElementById("inIssuedQty").value = "";
                    document.getElementById("returnGoodQty").value = 0;
                    document.getElementById("returnDamagedQty").value = 0;
                    document.getElementById("returnMissingQty").value = 0;
                    return;
                }
                const qty = value.split("|")[1];
                document.getElementById("inIssuedQty").value = qty;
                document.getElementById("returnGoodQty").value = qty;
                document.getElementById("returnDamagedQty").value = 0;
                document.getElementById("returnMissingQty").value = 0;
            }
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
    
    if(!stuId || !compId) {
        alert("Please select Student and Component");
        btn.innerText = "Confirm OUT";
        return;
    }

    const comp = componentsData.find(c => c.id === compId);
    // Fetch the correct name from the select text
    const studentText = outStudent.options[outStudent.selectedIndex].text;
    const stuName = studentText.split(" (")[0];

    if (qty > comp.availableQty) {
        alert("Not enough stock available!");
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
            issuedBy: currentUser.uid,
            handledBy: staffName
        });

        // 2. Decrease Stock
        const compRef = doc(db, "components", compId);
        batch.update(compRef, { availableQty: comp.availableQty - qty });

        await batch.commit();
        alert("Successfully Issued!");
        
        // Reset form completely including TomSelect UI
        document.getElementById("issueForm").reset();
        tsStudent.clear();
        tsComponent.clear();
        
        loadDropdowns(); // refresh data
    } catch (err) {
        alert("Error issuing component");
        console.error(err);
    }
    btn.innerText = "Confirm OUT";
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

document.getElementById("returnForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.innerText = "Processing...";

    const txVal = inTransaction.value;
    
    if(!txVal) {
        alert("Please select an issue to return.");
        btn.innerText = "Confirm IN";
        return;
    }

    const txId = txVal.split("|")[0];
    const issuedQty = Number(txVal.split("|")[1]);
    
    const goodQty = Number(document.getElementById("returnGoodQty").value) || 0;
    const damagedQty = Number(document.getElementById("returnDamagedQty").value) || 0;
    const missingQty = Number(document.getElementById("returnMissingQty").value) || 0;
    const totalReturned = goodQty + damagedQty + missingQty;
    
    if (totalReturned > issuedQty || totalReturned === 0) {
        alert(`Total return quantity (${totalReturned}) must be between 1 and ${issuedQty}.`);
        btn.innerText = "Confirm IN";
        return;
    }

    try {
        const txDoc = await getDoc(doc(db, "transactions", txId)); 
        if(!txDoc.exists()) throw new Error("Transaction not found");
        const originalTx = txDoc.data();

        const batch = writeBatch(db);

        if (totalReturned === issuedQty) {
            // 1. Mark original as Returned and store details
            batch.update(doc(db, "transactions", txId), { 
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
        const comp = componentsData.find(c => c.id === originalTx.componentId);
        if (comp) {
            batch.update(doc(db, "components", originalTx.componentId), { 
                availableQty: comp.availableQty + goodQty,
                totalQty: comp.totalQty - (damagedQty + missingQty)
            });
        }

        await batch.commit();
        alert("Successfully Returned!");
        
        document.getElementById("returnForm").reset();
        tsTransaction.clear();
        
        loadDropdowns();
    } catch (err) {
        alert("Error returning component");
        console.error(err);
    }
    btn.innerText = "Confirm IN";
});
