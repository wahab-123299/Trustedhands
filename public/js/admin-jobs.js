// =============================================
// admin-job.js — Trusted Hand Admin Job Manager
// =============================================

// ✅ Demo Job Data (numeric price)
let jobs = JSON.parse(localStorage.getItem("jobs")) || [
  {
    id: 1,
    title: "Plumbing Repair",
    customer: "John Doe",
    artisan: "Michael Ade",
    location: "Lagos",
    date: "2025-11-05",
    status: "Pending",
    price: 20000,
  },
  {
    id: 2,
    title: "AC Installation",
    customer: "Mary Smith",
    artisan: "Chinwe Okafor",
    location: "Abuja",
    date: "2025-11-01",
    status: "Approved",
    price: 50000,
  },
];

// DOM Elements
const tableBody = document.getElementById("jobTableBody");
const jobSearch = document.getElementById("jobSearch");
const editModal = document.getElementById("editJobModal");
const editForm = document.getElementById("editJobForm");

let selectedJobId = null;

// ===============================
// RENDER JOBS (Single Source)
// ===============================
function renderJobs(data = jobs) {
  tableBody.innerHTML = "";

  if (!data.length) {
    tableBody.innerHTML = `<tr><td colspan="8">No job records found.</td></tr>`;
    return;
  }

  data.forEach((job) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${job.id}</td>
      <td>${job.title}</td>
      <td>${job.customer}</td>
      <td>${job.artisan}</td>
      <td>${job.location}</td>
      <td>₦${job.price.toLocaleString()}</td>
      <td>
        <span class="status ${job.status.toLowerCase()}">${job.status}</span>
      </td>
      <td>
        ${
          job.status === "Pending"
            ? `<button class="btn-approve" data-id="${job.id}">Approve</button>`
            : `<button class="btn-cancel" data-id="${job.id}">Cancel</button>`
        }
        <button class="btn-edit" data-id="${job.id}">Edit</button>
        <button class="btn-delete" data-id="${job.id}">Delete</button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  saveToStorage();
}

// ===============================
// ACTION HANDLERS
// ===============================
tableBody.addEventListener("click", (e) => {
  const id = Number(e.target.dataset.id);
  if (!id) return;

  if (e.target.classList.contains("btn-approve")) approveJob(id);
  if (e.target.classList.contains("btn-cancel")) cancelJob(id);
  if (e.target.classList.contains("btn-edit")) openEditModal(id);
  if (e.target.classList.contains("btn-delete")) deleteJob(id);
});

// ===============================
// JOB ACTIONS
// ===============================
function approveJob(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  job.status = "Approved";
  alert(`✅ Job "${job.title}" approved`);
  renderJobs();
}

function cancelJob(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  if (confirm(`Cancel job "${job.title}"?`)) {
    job.status = "Cancelled";
    alert("❌ Job cancelled");
    renderJobs();
  }
}

function deleteJob(id) {
  if (!confirm("Delete this job permanently?")) return;
  jobs = jobs.filter(j => j.id !== id);
  alert("🗑️ Job deleted");
  renderJobs();
}

// ===============================
// EDIT MODAL
// ===============================
function openEditModal(id) {
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  selectedJobId = id;

  document.getElementById("editJobId").value = job.id;
  document.getElementById("editJobTitle").value = job.title;
  document.getElementById("editJobPrice").value = job.price;
  document.getElementById("editJobStatus").value = job.status;

  editModal.style.display = "flex";
}

function closeEditModal() {
  editModal.style.display = "none";
  selectedJobId = null;
}

// Save edited job
editForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = document.getElementById("editJobTitle").value.trim();
  const price = Number(document.getElementById("editJobPrice").value);
  const status = document.getElementById("editJobStatus").value;

  if (!title || !price) {
    alert("All fields are required");
    return;
  }

  const job = jobs.find(j => j.id === selectedJobId);
  if (!job) return;

  job.title = title;
  job.price = price;
  job.status = status;

  alert("✅ Job updated");
  closeEditModal();
  renderJobs();
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

document.querySelector(".close-modal")?.addEventListener("click", closeEditModal);

// ===============================
// SEARCH
// ===============================
jobSearch?.addEventListener("input", () => {
  const value = jobSearch.value.toLowerCase();

  const filtered = jobs.filter(
    j =>
      j.title.toLowerCase().includes(value) ||
      j.customer.toLowerCase().includes(value) ||
      j.artisan.toLowerCase().includes(value)
  );

  renderJobs(filtered);
});

// ===============================
// STORAGE
// ===============================
function saveToStorage() {
  localStorage.setItem("jobs", JSON.stringify(jobs));
}

// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => renderJobs());