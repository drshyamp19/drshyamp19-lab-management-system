import { db, auth } from "./firebase-init.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const reportsBody = document.getElementById("reportsBody");
const exportExcelBtn = document.getElementById("exportExcelBtn");
let allTransactions = [];

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
    else loadReports();
});

async function loadReports() {
    try {
        const q = query(collection(db, "transactions"), orderBy("dateTime", "desc"));
        const querySnapshot = await getDocs(q);
        reportsBody.innerHTML = "";
        allTransactions = [];
        
        if (querySnapshot.empty) {
            reportsBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No transactions yet.</td></tr>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const tx = doc.data();
            allTransactions.push(tx);
            const row = document.createElement("tr");
            row.className = "border-b border-gray-100 hover:bg-gray-50";
            
            const typeBadge = tx.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

            row.innerHTML = `
                <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${typeBadge}">${tx.type}</span></td>
                <td class="p-4 font-medium text-gray-900">${tx.componentName}</td>
                <td class="p-4 text-gray-600">${tx.studentName}</td>
                <td class="p-4 font-bold text-gray-900">${tx.quantity}</td>
                <td class="p-4 text-sm text-gray-500">${tx.type === 'OUT' ? tx.status : tx.condition}</td>
                <td class="p-4 text-sm text-gray-500">${tx.handledBy || 'N/A'}</td>
            `;
            reportsBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error loading reports:", error);
        reportsBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error loading data</td></tr>`;
    }
}

exportExcelBtn.addEventListener("click", () => {
    if (allTransactions.length === 0) return alert("No data to export!");

    // Clean data for Excel
    const excelData = allTransactions.map(tx => ({
        "Type": tx.type,
        "Component": tx.componentName,
        "Student": tx.studentName,
        "Quantity": tx.quantity,
        "Status / Condition": tx.type === 'OUT' ? tx.status : tx.condition,
        "Handled By (Staff)": tx.handledBy || 'N/A',
        "Date": tx.dateTime ? tx.dateTime.toDate().toLocaleString() : ""
    }));

    // Generate Excel using SheetJS (included via CDN in HTML)
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reports");
    XLSX.writeFile(workbook, "Lab_Transactions_Report.xlsx");
});
