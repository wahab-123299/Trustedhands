// Sample payment data
const payments = [
  { id: "TXN001", user: "Samuel Okoro", artisan: "John Musa", job: "Plumbing Repair", amount: 7500, date: "2025-11-02", status: "Completed" },
  { id: "TXN002", user: "Joy Nwankwo", artisan: "Chioma Ude", job: "Electrical Wiring", amount: 12000, date: "2025-11-03", status: "Pending" },
  { id: "TXN003", user: "David Bassey", artisan: "Bayo Hassan", job: "Painting Work", amount: 5000, date: "2025-11-01", status: "Refunded" }
];

const paymentList = document.getElementById("paymentList");
const modal = document.getElementById("paymentModal");
const closeModal = document.querySelector(".close");
const editForm = document.getElementById("editPaymentForm");

let selectedPayment = null;

// Load payment data
function loadPayments() {
  paymentList.innerHTML = "";
  payments.forEach((p) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.user}</td>
      <td>${p.artisan}</td>
      <td>${p.job}</td>
      <td>${p.amount.toLocaleString()}</td>
      <td>${p.date}</td>
      <td><span class="status ${p.status.toLowerCase()}">${p.status}</span></td>
      <td>
        <button class="edit-btn" onclick="openEditModal('${p.id}')">Edit</button>
        <button class="delete-btn" onclick="deletePayment('${p.id}')">Delete</button>
      </td>
    `;
    paymentList.appendChild(row);
  });
}

// Open edit modal
function openEditModal(id) {
  selectedPayment = payments.find((p) => p.id === id);
  document.getElementById("paymentStatus").value = selectedPayment.status;
  modal.style.display = "block";
}

// Close modal
closeModal.onclick = () => {
  modal.style.display = "none";
};

// Save changes
editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedPayment) return;
  selectedPayment.status = document.getElementById("paymentStatus").value;
  loadPayments();
  modal.style.display = "none";
});

// Delete payment
function deletePayment(id) {
  const confirmDelete = confirm("Are you sure you want to delete this payment?");
  if (confirmDelete) {
    const index = payments.findIndex((p) => p.id === id);
    if (index > -1) payments.splice(index, 1);
    loadPayments();
  }
}

// Close when clicking outside modal
window.onclick = (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
};

// Initialize
loadPayments();