// Save profile settings
document.getElementById("adminProfileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("adminName").value;
  const email = document.getElementById("adminEmail").value;

  alert(`Profile updated successfully:\nName: ${name}\nEmail: ${email}`);
});

// Update service fee
document.getElementById("feeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const fee = document.getElementById("serviceFee").value;
  alert(`Service fee updated to ${fee}%`);
});

// Update notifications
document.getElementById("notificationForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const emailNotif = document.getElementById("emailNotif").checked;
  const smsNotif = document.getElementById("smsNotif").checked;

  alert(
    `Notification preferences saved:\nEmail: ${emailNotif ? "On" : "Off"}\nSMS: ${smsNotif ? "On" : "Off"}`
  );
});

// Change password
document.getElementById("passwordForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const oldPass = document.getElementById("oldPassword").value;
  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmPassword").value;

  if (newPass !== confirmPass) {
    alert("New password and confirmation do not match!");
    return;
  }

  alert("Password changed successfully!");
});