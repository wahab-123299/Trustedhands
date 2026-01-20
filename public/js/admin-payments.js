// =============================================
// admin-payment.js — Trusted Hand Admin Payments
// =============================================

// ✅ Demo Payment Data (amount as number)
let payments = JSON.parse(localStorage.getItem("payments")) || [
  {
    id: "TXN001",
    user: "Samuel Okoro",
    artisan: "John Musa",
    job: "Plumbing Repair",
    amount: 7500,
    date: "2025-11-02",
    status: "Completed",
  },
  {
    id: "TXN002",
    user: "Joy Nwankwo",
    artisan: "Chioma Ude",
    job: "Electrical Wiring",
    amount: 12000,
    date: "2025-11-03",
    status: "Pending",
  },
  {
    id: "TXN003",
    user: "David Bassey",
    artisan: "Bayo Hassan",
    job: "Painting Work",
    amount: 5000,
    date: "2025-11-01",
    status: "Refunded",
  },
];

// DOM Elements
const paymentList = document.getElementById("paymentList");
const modal = document.getElementById("paymentModal");
const closeModalBtn = document.querySelector(".close");
const editForm = document.getElementById("editPaymentForm");

let selectedPaymentId = null;

// ===============================
// RENDER PAYMENTS
// ===============================
function renderPayments(data = payments) {
  paymentList.innerHTML = "";

  if (!data.length) {
    paymentList.innerHTML = `<tr><td colspan="8">No payments found.</td></tr>`;
    return;
  }

  data.forEach((p) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.id}</td>
      <td>${p.user}</td>
      <td>${p.artisan}</td>
      <td>${p.job}</td>
      <td>₦${p.amount.toLocaleString()}</td>
      <td>${p.date}</td>
      <td>
        <span class="status ${p.status.toLowerCase()}">${p.status}</span>
      </td>
      <td>
        <button class="btn-edit" data-id="${p.id}">Edit</button>
        <button class="btn-delete" data-id="${p.id}">Delete</button>
      </td>
    `;

    paymentList.appendChild(row);
  });

  savePayments();
}

// ===============================
// EVENT DELEGATION
// ===============================
paymentList.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains("btn-edit")) {
    openEditModal(id);
  }

  if (e.target.classList.contains("btn-delete")) {
    deletePayment(id);
  }
});

// ===============================
// MODAL LOGIC
// ===============================
function openEditModal(id) {
  const payment = payments.find(p => p.id === id);
  if (!payment) return;

  selectedPaymentId = id;
  document.getElementById("paymentStatus").value = payment.status;
  modal.style.display = "flex";
}

function closeModal() {
  modal.style.display = "none";
  selectedPaymentId = null;
}

closeModalBtn?.addEventListener("click", closeModal);

// Close when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ===============================
// SAVE EDIT
// ===============================
editForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const status = document.getElementById("paymentStatus").value;
  const payment = payments.find(p => p.id === selectedPaymentId);
  if (!payment) return;

  payment.status = status;
  alert("✅ Payment status updated");

  closeModal();
  renderPayments();
});

// ===============================
// DELETE PAYMENT
// ===============================
function deletePayment(id) {
  if (!confirm("Delete this payment record?")) return;

  payments = payments.filter(p => p.id !== id);
  alert("🗑️ Payment deleted");
  renderPayments();
}

// ===============================
// STORAGE
// ===============================
function savePayments() {
  localStorage.setItem("payments", JSON.stringify(payments));
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => renderPayments());
