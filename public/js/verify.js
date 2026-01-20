// =======================================
// VERIFY.JS — Trusted Hand Payment Verify
// =======================================

// Get reference from URL
const params = new URLSearchParams(window.location.search);
const reference = params.get("reference");

// Validate reference
if (!reference) {
  alert("Invalid payment reference");
  window.location.href = "/customer/my-bookings.html";
}

// Verify payment
async function verifyPayment() {
  try {
    const res = await fetch(
      `https://trustedhands-backend.onrender.com/api/payments/verify?reference=${reference}`
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Payment verification failed");
      window.location.href = "/customer/my-bookings.html";
      return;
    }

    // ✅ VERIFIED
    alert("✅ Payment successful!");
    window.location.href = "/customer/my-bookings.html";

  } catch (err) {
    console.error(err);
    alert("❌ Server error while verifying payment");
    window.location.href = "/customer/my-bookings.html";
  }
}

// Run verification
verifyPayment();
