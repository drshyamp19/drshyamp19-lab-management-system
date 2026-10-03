import { db, auth } from "./firebase-init.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const studentsTableBody = document.getElementById("studentsTableBody");
const addStudentModal = document.getElementById("addStudentModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addStudentForm = document.getElementById("addStudentForm");

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    else loadStudents();
});

async function loadStudents() {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        studentsTableBody.innerHTML = "";
        
        if (querySnapshot.empty) {
            studentsTableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">No students found.</td></tr>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const student = doc.data();
            const row = document.createElement("tr");
            row.className = "border-b border-gray-100 hover:bg-gray-50";
            row.innerHTML = `
                <td class="p-4 font-mono text-sm text-gray-600">${student.uid}</td>
                <td class="p-4 font-medium text-gray-900">${student.name}</td>
                <td class="p-4 text-gray-600">${student.course}</td>
            `;
            studentsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading students:", error);
        studentsTableBody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error loading data</td></tr>`;
    }
}

showAddModalBtn.addEventListener("click", () => addStudentModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addStudentModal.classList.add("hidden"));

addStudentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = addStudentForm.querySelector("button[type=submit]");
    btn.innerText = "Saving...";
    
    try {
        await addDoc(collection(db, "students"), {
            uid: document.getElementById("stuUid").value,
            name: document.getElementById("stuName").value,
            course: document.getElementById("stuCourse").value,
            createdAt: new Date()
        });
        
        addStudentModal.classList.add("hidden");
        addStudentForm.reset();
        btn.innerText = "Save";
        loadStudents(); // Reload table
    } catch (error) {
        console.error("Error adding student:", error);
        alert("Failed to add student.");
        btn.innerText = "Save";
    }
});
