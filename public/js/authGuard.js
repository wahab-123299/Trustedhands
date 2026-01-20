export function requireAuth(requiredRole = null) {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  // ❌ Not logged in
  if (!userInfo || !userInfo.token) {
    window.location.href = "/public/auth/login.html";
    return;
  }

  // ❌ Logged in but wrong role
  if (requiredRole && userInfo.role !== requiredRole) {
    alert("⛔ Access denied");
    window.location.href = "/public/index.html";
    return;
  }

  // ✅ Authorized (do nothing, allow page)
}
