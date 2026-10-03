import { db, auth } from "./firebase-init.js";
import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDo0JZJprn5SWb11gnCzI-Hk22G5jGbplI",
    authDomain: "lab-component-system.firebaseapp.com",
    projectId: "lab-component-system",
    storageBucket: "lab-component-system.firebasestorage.app",
    messagingSenderId: "92081415477",
    appId: "1:92081415477:web:bf51a975f654b7e42b187c"
};

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

const usersTableBody = document.getElementById("usersTableBody");
const addUserModal = document.getElementById("addUserModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addUserForm = document.getElementById("addUserForm");

let currentAdminId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    currentAdminId = user.uid;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists() && userDoc.data().role !== "ADMIN") {
        alert("Access Denied: Only Admin can create or delete users.");
        window.location.href = "dashboard.html";
    } else {
        loadUsers();
    }
});

async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        usersTableBody.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const u = docSnap.data();
            const row = document.createElement("tr");
            row.className = "border-b border-gray-100 hover:bg-gray-50";
            
            let roleBadge = "bg-gray-100 text-gray-800";
            if(u.role === 'ADMIN') roleBadge = "bg-red-600 text-white";
            if(u.role === 'HOD') roleBadge = "bg-purple-100 text-purple-800";
            if(u.role === 'IN_CHARGE') roleBadge = "bg-blue-100 text-blue-800";
            if(u.role === 'ASSISTANT') roleBadge = "bg-green-100 text-green-800";

            const perms = u.permissions ? u.permissions.join(", ") : "All";
            
            // Delete button logic
            let actionHtml = "";
            if(u.role === 'ADMIN') {
                actionHtml = `<span class="text-xs text-gray-400">Master</span>`;
            } else if (u.status === 'Inactive') {
                actionHtml = `
                    <div class="flex flex-col gap-1 items-end">
                        <span class="text-xs font-bold text-red-600">Blocked</span>
                        <button onclick="reactivateUser('${docSnap.id}')" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold">Unblock</button>
                    </div>
                `;
            } else {
                actionHtml = `<button onclick="deleteUser('${docSnap.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Block</button>`;
            }

            row.innerHTML = `
                <td class="p-4 font-medium text-gray-900">${u.name}</td>
                <td class="p-4 text-gray-600">${u.email}</td>
                <td class="p-4 text-xs font-mono text-gray-800 bg-gray-50 rounded">${u.savedPassword || 'N/A'}</td>
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${roleBadge}">${u.role}</span></td>
                <td class="p-4 text-xs text-gray-500 uppercase">${perms}</td>
                <td class="p-4 text-right">${actionHtml}</td>
            `;
            usersTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

// Make delete function globally available to HTML onclick
window.deleteUser = async function(uid) {
    if(confirm("Are you sure you want to block this user? They will not be able to log in.")) {
        try {
            await updateDoc(doc(db, "users", uid), { status: "Inactive" });
            alert("User blocked successfully.");
            loadUsers();
        } catch(e) {
            alert("Error blocking user.");
            console.error(e);
        }
    }
};

window.reactivateUser = async function(uid) {
    if(confirm("Are you sure you want to UNBLOCK this user? They will be able to log in again.")) {
        try {
            await updateDoc(doc(db, "users", uid), { status: "Active" });
            alert("User reactivated successfully.");
            loadUsers();
        } catch(e) {
            alert("Error reactivating user.");
            console.error(e);
        }
    }
};

showAddModalBtn.addEventListener("click", () => addUserModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => addUserModal.classList.add("hidden"));

addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = addUserForm.querySelector("button[type=submit]");
    btn.innerText = "Creating...";
    
    try {
        const name = document.getElementById("userName").value;
        const email = document.getElementById("userEmail").value;
        const password = document.getElementById("userPassword").value;
        const role = document.getElementById("userRole").value;

        const checkboxes = document.querySelectorAll('input[name="permissions"]:checked');
        const selectedPermissions = Array.from(checkboxes).map(cb => cb.value);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUserUid = userCredential.user.uid;

        await setDoc(doc(db, "users", newUserUid), {
            name: name,
            email: email,
            role: role,
            savedPassword: password, // Special option to view password
            permissions: selectedPermissions,
            status: "Active",
            createdAt: new Date()
        });

        await signOut(secondaryAuth);

        addUserModal.classList.add("hidden");
        addUserForm.reset();
        btn.innerText = "Create Account";
        alert(role + " Account Created Successfully!");
        loadUsers();
    } catch (error) {
        console.error("Error adding user:", error);
        alert("Failed: " + error.message);
        btn.innerText = "Create Account";
    }
});
