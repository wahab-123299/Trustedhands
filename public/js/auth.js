// ===============================
// AUTH.JS — Trusted Hand
// Handles Signup, Login & Logout
// ===============================

// ===== SIGNUP =====
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value.trim();
    const confirm = document.getElementById("signupConfirm") 
      ? document.getElementById("signupConfirm").value.trim() 
      : password;

    // Validation
    if (!name || !email || !password) {
      alert("⚠️ Please fill in all fields.");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      alert("⚠️ Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      alert("⚠️ Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      alert("⚠️ Passwords do not match.");
      return;
    }

    // Load existing users
    const users = JSON.parse(localStorage.getItem("users")) || [];

    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      alert("⚠️ User already exists with this email!");
      return;
    }

    // Create new user
    const newUser = {
      name,
      email,
      password,
      role: "user", // default role
      joinedAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));

    alert("✅ Signup successful! Redirecting to login page...");
    window.location.href = "login.html";
  });
}

// ===== LOGIN =====
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      alert("⚠️ Please fill in both fields.");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users")) || [];
    const user = users.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      alert("❌ Invalid email or password.");
      return;
    }

    // Save current user session
    localStorage.setItem("currentUser", JSON.stringify(user));

    alert(`👋 Welcome back, ${user.name}!`);

    // Redirect based on role
    if (user.role === "admin") {
      window.location.href = "admin-dashboard.html";
    } else {
      window.location.href = "dashboard.html";
    }
  });
}

// ===== LOGOUT =====
function logout() {
  localStorage.removeItem("currentUser");
  alert("👋 You have been logged out.");
  window.location.href = "login.html";
}

// ===== SESSION CHECK =====
function checkAuth() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (!user) {
    alert("⚠️ Please log in first.");
    window.location.href = "login.html";
  }
}

// ===== AUTO-FILL DASHBOARD =====
function loadUserData() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  if (user && document.getElementById("welcomeUser")) {
    document.getElementById("welcomeUser").textContent = user.name;
  }
}
