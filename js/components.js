import { db, auth } from "./firebase-init.js";
import { collection, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const componentsGrid = document.getElementById("componentsGrid");
const addCompModal = document.getElementById("addCompModal");
const showAddModalBtn = document.getElementById("showAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const addCompForm = document.getElementById("addCompForm");

const downloadSampleBtn = document.getElementById("downloadSampleBtn");
const uploadCsvBtn = document.getElementById("uploadCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");

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

// Single Add Component
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
    // Note: Category must be exactly CONSUMABLE or NON_CONSUMABLE for the logic to work later
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
        // Split text by new lines, remove empty lines
        const rows = text.split("\n").filter(row => row.trim().length > 0).slice(1); 
        
        if (rows.length === 0) return alert("File is empty or invalid format.");
        
        uploadCsvBtn.innerText = "Uploading...";
        let count = 0;
        
        try {
            for (let row of rows) {
                const cols = row.split(",");
                if (cols.length >= 3) {
                    const qty = Number(cols[2].trim());
                    // Fallback to NON_CONSUMABLE if user typed wrong
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
            csvFileInput.value = ""; // reset input
            uploadCsvBtn.innerText = "↑ Upload CSV";
            loadComponents();
        } catch (error) {
            console.error(error);
            alert("Error uploading data.");
            uploadCsvBtn.innerText = "↑ Upload CSV";
        }
    };
    reader.readAsText(file);
});
