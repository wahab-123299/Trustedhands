// =============================================
// admin-artisan.js — Trusted Hand Admin Dashboard
// =============================================

// ✅ Load artisans from localStorage or fallback demo data
let artisans = JSON.parse(localStorage.getItem("artisans")) || [
  { id: 1, name: "John Ade", skill: "Electrician", location: "Lagos", rating: 4.7, status: "Active" },
  { id: 2, name: "Mary Eze", skill: "Plumber", location: "Abuja", rating: 4.2, status: "Pending" },
  { id: 3, name: "Kola Yusuf", skill: "Painter", location: "Ibadan", rating: 4.5, status: "Active" },
  { id: 4, name: "Titi Danjuma", skill: "Carpenter", location: "Port Harcourt", rating: 3.9, status: "Suspended" },
];

// ✅ DOM Elements
const artisanList = document.getElementById("artisanList");
const modal = document.getElementById("artisanModal");
const closeModal = document.querySelector(".close");
const editForm = document.getElementById("editArtisanForm");
const searchInput = document.getElementById("searchArtisan");

let selectedArtisan = null;

// =============================================
// LOAD ARTISANS
// =============================================
function loadArtisans(data = artisans) {
  artisanList.innerHTML = "";

  if (!data.length) {
    artisanList.innerHTML = `<tr><td colspan="7">No artisans found.</td></tr>`;
    return;
  }

  data.forEach((artisan) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${artisan.id}</td>
      <td>${artisan.name}</td>
      <td>${artisan.skill}</td>
      <td>${artisan.location}</td>
      <td>${artisan.rating ?? "N/A"}</td>
      <td>
        <span class="status ${artisan.status.toLowerCase()}">
          ${artisan.status}
        </span>
      </td>
      <td>
        <button class="btn-edit" data-id="${artisan.id}">Edit</button>
        <button class="btn-toggle" data-id="${artisan.id}">
          ${artisan.status === "Active" ? "Suspend" : "Activate"}
        </button>
        <button class="btn-delete" data-id="${artisan.id}">Delete</button>
      </td>
    `;

    artisanList.appendChild(row);
  });

  saveArtisans();
}

// =============================================
// MODAL HANDLING
// =============================================
function openEditModal(id) {
  selectedArtisan = artisans.find(a => a.id === id);
  if (!selectedArtisan) return;

  document.getElementById("artisanId").value = selectedArtisan.id;
  document.getElementById("artisanName").value = selectedArtisan.name;
  document.getElementById("artisanSkill").value = selectedArtisan.skill;
  document.getElementById("artisanLocation").value = selectedArtisan.location;
  document.getElementById("artisanStatus").value = selectedArtisan.status;

  modal.style.display = "flex";
}

closeModal?.addEventListener("click", () => {
  modal.style.display = "none";
});

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// =============================================
// EDIT ARTISAN
// =============================================
editForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedArtisan) return;

  const name = document.getElementById("artisanName").value.trim();
  const skill = document.getElementById("artisanSkill").value.trim();
  const location = document.getElementById("artisanLocation").value.trim();
  const status = document.getElementById("artisanStatus").value;

  if (!name || !skill || !location) {
    alert("⚠️ Please fill all required fields.");
    return;
  }

  Object.assign(selectedArtisan, { name, skill, location, status });

  alert(`✅ Artisan "${name}" updated successfully.`);
  modal.style.display = "none";
  loadArtisans();
});

// =============================================
// DELETE ARTISAN
// =============================================
function deleteArtisan(id) {
  if (!confirm("Are you sure you want to delete this artisan?")) return;

  artisans = artisans.filter(a => a.id !== id);
  alert("🗑️ Artisan deleted successfully.");
  loadArtisans();
}

// =============================================
// TOGGLE STATUS
// =============================================
function toggleStatus(id) {
  const artisan = artisans.find(a => a.id === id);
  if (!artisan) return;

  artisan.status = artisan.status === "Active" ? "Suspended" : "Active";
  alert(`⚙️ ${artisan.name} is now ${artisan.status}.`);
  loadArtisans();
}

// =============================================
// SEARCH
// =============================================
function searchArtisans() {
  const search = searchInput.value.toLowerCase();

  const filtered = artisans.filter(a =>
    a.name.toLowerCase().includes(search) ||
    a.skill.toLowerCase().includes(search) ||
    a.location.toLowerCase().includes(search)
  );

  loadArtisans(filtered);
}

searchInput?.addEventListener("input", searchArtisans);

// =============================================
// EVENT DELEGATION (FIXED INLINE onclick BUG)
// =============================================
artisanList?.addEventListener("click", (e) => {
  const id = Number(e.target.dataset.id);
  if (!id) return;

  if (e.target.classList.contains("btn-edit")) {
    openEditModal(id);
  }

  if (e.target.classList.contains("btn-toggle")) {
    toggleStatus(id);
  }

  if (e.target.classList.contains("btn-delete")) {
    deleteArtisan(id);
  }
});

// =============================================
// LOCAL STORAGE
// =============================================
function saveArtisans() {
  localStorage.setItem("artisans", JSON.stringify(artisans));
}

// =============================================
// INIT
// =============================================
document.addEventListener("DOMContentLoaded", loadArtisans);
