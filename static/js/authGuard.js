export function requireAuth(role = null) {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (!userInfo || !userInfo.token) {
    window.location.href = "/public/auth/login.html";
    return;
  }

  if (role && userInfo.role !== role) {
    alert("Access denied");
    window.location.href = "/public/index.html";
  }
}
