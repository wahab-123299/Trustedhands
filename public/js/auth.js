// ===============================
// AUTH.JS — Trusted Hand (REAL)
// Frontend Auth + JWT Handling
// ===============================

const API_BASE = "/api/users";

/* ======================
   SIGNUP
====================== */
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("Name")?.value.trim();
    const email = document
      .getElementById("signupEmail")
      ?.value.trim()
      .toLowerCase();
    const password = document.getElementById("signupPassword")?.value.trim();
    const role = document.getElementById("signupRole")?.value || "customer";

    if (!name || !email || !password) {
      alert("⚠️ Please fill in all fields");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Signup failed");
        return;
      }

      alert("✅ Signup successful. Please login.");
      window.location.href = "/auth/login.html";
    } catch (error) {
      console.error(error);
      alert("❌ Server error. Try again later.");
    }
  });
}

/* ======================
   LOGIN
====================== */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document
      .getElementById("loginEmail")
      ?.value.trim()
      .toLowerCase();
    const password = document.getElementById("loginPassword")?.value.trim();

    if (!email || !password) {
      alert("⚠️ Please fill in both fields");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Invalid email or password");
        return;
      }

      // ✅ Save login session
      localStorage.setItem("userInfo", JSON.stringify(data));

      // ✅ Redirect based on role
      switch (data.role) {
        case "admin":
          window.location.href = "/admin/dashboard.html";
          break;
        case "artisan":
          window.location.href = "/artisan/dashboard.html";
          break;
        default:
          window.location.href = "/customer/dashboard.html";
      }
    } catch (error) {
      console.error(error);
      alert("❌ Server error. Try again later.");
    }
  });
}

/* ======================
   LOGOUT
====================== */
function logout() {
  localStorage.removeItem("userInfo");
  window.location.href = "/auth/login.html";
}

/* ======================
   AUTH CHECK (PROTECT PAGES)
====================== */
function requireAuth(requiredRole = null) {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (!userInfo || !userInfo.token) {
    window.location.href = "/auth/login.html";
    return;
  }

  if (requiredRole && userInfo.role !== requiredRole) {
    alert("⛔ Unauthorized access");
    window.location.href = "/";
  }
}

/* ======================
   LOAD LOGGED-IN USER
====================== */
function loadUser() {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (userInfo && document.getElementById("welcomeUser")) {
    document.getElementById("welcomeUser").textContent = userInfo.name;
  }
}

/* ======================
   AUTH HEADER HELPER
   (For API requests)
====================== */
function getAuthHeaders() {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userInfo?.token}`,
  };
}
