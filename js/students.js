import { db, auth } from "./firebase-init.js";
import { collection, getDocs, setDoc, doc, writeBatch, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    else loadStudents();
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
            <td class="p-4 text-gray-600">${st.name}</td>
            <td class="p-4 text-gray-600">${st.course}</td>
            <td class="p-4 text-right">
                <button onclick="openIssueModal('${st.uid}', '${st.name.replace(/'/g, "\\'")}')" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-md text-xs font-bold transition">Issue Item</button>
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
