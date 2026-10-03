import { db, auth } from "./firebase-init.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const componentsGrid = document.getElementById("componentsGrid");
const addCompModal = document.getElementById("addCompModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addCompForm = document.getElementById("addCompForm");

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    else loadComponents();
});

async function loadComponents() {
    try {
        const querySnapshot = await getDocs(collection(db, "components"));
        componentsGrid.innerHTML = "";
        
        if (querySnapshot.empty) {
            componentsGrid.innerHTML = `<p class="col-span-full text-center text-gray-500">No components found. Add some!</p>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const comp = doc.data();
            const card = document.createElement("div");
            card.className = "bg-white p-5 rounded-xl shadow-sm border border-gray-200";
            
            const badgeColor = comp.category === "CONSUMABLE" ? "bg-orange-100 text-orange-800" : "bg-purple-100 text-purple-800";
            const catText = comp.category === "CONSUMABLE" ? "Consumable" : "Non-Consumable";

            card.innerHTML = `
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
            `;
            componentsGrid.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading components:", error);
        componentsGrid.innerHTML = `<p class="text-red-500">Error loading data.</p>`;
    }
}

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
            availableQty: qty, // सुरुवातीला availableQty = totalQty
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
