// =============================================
// admin-job.js — Trusted Hand Admin Job Manager
// =============================================

// ✅ Temporary Job Data (for demo)
let jobs = JSON.parse(localStorage.getItem("jobs")) || [
  {
    id: 1,
    title: "Plumbing Repair",
    customer: "John Doe",
    artisan: "Michael Ade",
    location: "Lagos",
    date: "2025-11-05",
    status: "Pending",
    price: "₦20,000",
  },
  {
    id: 2,
    title: "AC Installation",
    customer: "Mary Smith",
    artisan: "Chinwe Okafor",
    location: "Abuja",
    date: "2025-11-01",
    status: "Approved",
    price: "₦50,000",
  },
];

// ✅ Load Jobs into Table
function loadJobs() {
  const tableBody = document.getElementById("jobTableBody");
  tableBody.innerHTML = "";

  if (jobs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7">No job records found.</td></tr>`;
    return;
  }

  jobs.forEach((job) => {
    const row = `
      <tr>
        <td>${job.id}</td>
        <td>${job.title}</td>
        <td>${job.customer}</td>
        <td>${job.artisan}</td>
        <td>${job.location}</td>
        <td>${job.price}</td>
        <td><span class="status ${job.status.toLowerCase()}">${job.status}</span></td>
        <td>
          ${
            job.status === "Pending"
              ? `<button class="btn-approve" onclick="approveJob(${job.id})">Approve</button>`
              : `<button class="btn-cancel" onclick="cancelJob(${job.id})">Cancel</button>`
          }
          <button class="btn-edit" onclick="openEditJob(${job.id})">Edit</button>
          <button class="btn-delete" onclick="deleteJob(${job.id})">Delete</button>
        </td>
      </tr>
    `;
    tableBody.innerHTML += row;
  });

  saveToStorage();
}

// ✅ Approve a Job
function approveJob(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;

  job.status = "Approved";
  alert(`✅ Job "${job.title}" approved.`);
  loadJobs();
}

// ✅ Cancel a Job
function cancelJob(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;

  if (confirm(`Cancel job "${job.title}"?`)) {
    job.status = "Cancelled";
    alert("❌ Job cancelled.");
    loadJobs();
  }
}

// ✅ Delete a Job
function deleteJob(id) {
  if (!confirm("Are you sure you want to delete this job?")) return;

  jobs = jobs.filter((job) => job.id !== id);
  alert("🗑️ Job deleted successfully.");
  loadJobs();
}

// ✅ Open Edit Modal
function openEditJob(id) {
  const job = jobs.find((j) => j.id === id);
  if (!job) return;

  document.getElementById("editJobId").value = job.id;
  document.getElementById("editJobTitle").value = job.title;
  document.getElementById("editJobPrice").value = job.price.replace("₦", "");
  document.getElementById("editJobStatus").value = job.status;

  document.getElementById("editJobModal").style.display = "flex";
}

// ✅ Save Job Edit
function saveJobEdit(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById("editJobId").value);
  const title = document.getElementById("editJobTitle").value.trim();
  const price = document.getElementById("editJobPrice").value.trim();
  const status = document.getElementById("editJobStatus").value;

  const job = jobs.find((j) => j.id === id);
  if (job) {
    job.title = title;
    job.price = `₦${price}`;
    job.status = status;
    alert("✅ Job details updated.");
  }

  closeEditJob();
  loadJobs();
}

// ✅ Close Edit Modal
function closeEditJob() {
  document.getElementById("editJobModal").style.display = "none";
}

// ✅ Filter Jobs
function filterJobs() {
  const search = document.getElementById("jobSearch").value.toLowerCase();
  const filtered = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(search) ||
      j.customer.toLowerCase().includes(search) ||
      j.artisan.toLowerCase().includes(search)
  );

  const tableBody = document.getElementById("jobTableBody");
  tableBody.innerHTML = "";
  filtered.forEach((job) => {
    const row = `
      <tr>
        <td>${job.id}</td>
        <td>${job.title}</td>
        <td>${job.customer}</td>
        <td>${job.artisan}</td>
        <td>${job.location}</td>
        <td>${job.price}</td>
        <td><span class="status ${job.status.toLowerCase()}">${job.status}</span></td>
      </tr>`;
    tableBody.innerHTML += row;
  });
}

// ✅ Save to Local Storage
function saveToStorage() {
  localStorage.setItem("jobs", JSON.stringify(jobs));
}

// ✅ Event Listeners
document.addEventListener("DOMContentLoaded", loadJobs);
document.getElementById("editJobForm")?.addEventListener("submit", saveJobEdit);
document.getElementById("jobSearch")?.addEventListener("input", filterJobs);
document.querySelector(".close-modal")?.addEventListener("click", closeEditJob);