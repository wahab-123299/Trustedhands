// =============================================
// admin-artisan.js — Trusted Hand Admin Dashboard
// =============================================

// ✅ Demo Data (Simulating Database)
let artisans = JSON.parse(localStorage.getItem("artisans")) || [
  { id: 1, name: "John Ade", skill: "Electrician", location: "Lagos", rating: 4.7, status: "Active" },
  { id: 2, name: "Mary Eze", skill: "Plumber", location: "Abuja", rating: 4.2, status: "Pending" },
  { id: 3, name: "Kola Yusuf", skill: "Painter", location: "Ibadan", rating: 4.5, status: "Active" },
  { id: 4, name: "Titi Danjuma", skill: "Carpenter", location: "Port Harcourt", rating: 3.9, status: "Suspended" },
];

const artisanList = document.getElementById("artisanList");
const modal = document.getElementById("artisanModal");
const closeModal = document.querySelector(".close");
const editForm = document.getElementById("editArtisanForm");
const searchInput = document.getElementById("searchArtisan");

let selectedArtisan = null;

// ✅ Load artisans into table
function loadArtisans(data = artisans) {
  artisanList.innerHTML = "";

  if (data.length === 0) {
    artisanList.innerHTML = `<tr><td colspan="6">No artisans found.</td></tr>`;
    return;
  }

  data.forEach((artisan) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${artisan.id}</td>
      <td>${artisan.name}</td>
      <td>${artisan.skill}</td>
      <td>${artisan.location}</td>
      <td>${artisan.rating}</td>
      <td><span class="status ${artisan.status.toLowerCase()}">${artisan.status}</span></td>
      <td>
        <button class="btn-edit" onclick="openEditModal(${artisan.id})">Edit</button>
        <button class="btn-toggle" onclick="toggleStatus(${artisan.id})">${artisan.status === "Active" ? "Suspend" : "Activate"}</button>
        <button class="btn-delete" onclick="deleteArtisan(${artisan.id})">Delete</button>
      </td>
    `;
    artisanList.appendChild(row);
  });

  saveArtisans();
}

// ✅ Open modal for editing
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

// ✅ Close modal
closeModal.onclick = () => (modal.style.display = "none");

// ✅ Save edited artisan
editForm.addEventListener("submit", (e) => {
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

  selectedArtisan.name = name;
  selectedArtisan.skill = skill;
  selectedArtisan.location = location;
  selectedArtisan.status = status;

  alert(`✅ Artisan "${name}" updated successfully.`);
  modal.style.display = "none";
  loadArtisans();
});

// ✅ Delete artisan
function deleteArtisan(id) {
  if (!confirm("Are you sure you want to delete this artisan?")) return;
  artisans = artisans.filter(a => a.id !== id);
  alert("🗑️ Artisan deleted successfully.");
  loadArtisans();
}

// ✅ Toggle artisan active/suspended status
function toggleStatus(id) {
  const artisan = artisans.find(a => a.id === id);
  if (!artisan) return;

  artisan.status = artisan.status === "Active" ? "Suspended" : "Active";
  alert(`⚙️ ${artisan.name} is now ${artisan.status}.`);
  loadArtisans();
}

// ✅ Search artisan by name, skill, or location
function searchArtisans() {
  const search = searchInput.value.toLowerCase();
  const filtered = artisans.filter(
    a =>
      a.name.toLowerCase().includes(search) ||
      a.skill.toLowerCase().includes(search) ||
      a.location.toLowerCase().includes(search)
  );
  loadArtisans(filtered);
}

// ✅ Save to local storage
function saveArtisans() {
  localStorage.setItem("artisans", JSON.stringify(artisans));
}

// ✅ Close modal when clicking outside
window.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};

// ✅ Event listeners
searchInput?.addEventListener("input", searchArtisans);
document.addEventListener("DOMContentLoaded", loadArtisans);