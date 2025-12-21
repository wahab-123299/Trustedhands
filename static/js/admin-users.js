// Sample customer data
const users = [
  { id: 1, name: "Samuel Okoro", email: "samuel@example.com", location: "Lagos", status: "Active" },
  { id: 2, name: "Joy Nwankwo", email: "joy@example.com", location: "Abuja", status: "Blocked" },
  { id: 3, name: "David Bassey", email: "david@example.com", location: "Ibadan", status: "Active" }
];

const userList = document.getElementById("userList");
const modal = document.getElementById("userModal");
const closeModal = document.querySelector(".close");
const editForm = document.getElementById("editUserForm");

let selectedUser = null;

// Load users into table
function loadUsers() {
  userList.innerHTML = "";

  users.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.location}</td>
      <td><span class="status ${user.status.toLowerCase()}">${user.status}</span></td>
      <td>
        <button class="edit-btn" onclick="openEditModal(${user.id})">Edit</button>
        <button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>
      </td>
    `;
    userList.appendChild(row);
  });
}

// Open modal for editing
function openEditModal(id) {
  selectedUser = users.find(u => u.id === id);
  document.getElementById("userName").value = selectedUser.name;
  document.getElementById("userEmail").value = selectedUser.email;
  document.getElementById("userLocation").value = selectedUser.location;
  document.getElementById("userStatus").value = selectedUser.status;
  modal.style.display = "block";
}

// Close modal
closeModal.onclick = () => {
  modal.style.display = "none";
};

// Save edited user
editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!selectedUser) return;

  selectedUser.name = document.getElementById("userName").value;
  selectedUser.email = document.getElementById("userEmail").value;
  selectedUser.location = document.getElementById("userLocation").value;
  selectedUser.status = document.getElementById("userStatus").value;

  loadUsers();
  modal.style.display = "none";
});

// Delete user
function deleteUser(id) {
  const confirmDelete = confirm("Are you sure you want to delete this user?");
  if (confirmDelete) {
    const index = users.findIndex(u => u.id === id);
    if (index > -1) users.splice(index, 1);
    loadUsers();
  }
}

// Close modal when clicking outside
window.onclick = (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
};

// Initial load
loadUsers();
