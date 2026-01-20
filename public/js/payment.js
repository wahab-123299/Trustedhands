// ================================
// PAYSTACK PAYMENT — FRONTEND
// ================================

// 🔐 Get stored data
const user = JSON.parse(localStorage.getItem("userInfo"));
const booking = JSON.parse(localStorage.getItem("bookingInfo"));

// ❌ Stop execution if required data is missing
if (!user || !user.token || !booking || !booking.amount) {
  alert("❌ Payment data missing. Please try again.");
  window.location.href = "/public/customer/dashboard.html";
  throw new Error("Payment initialization failed");
}

// 💳 Paystack payment function
function payWithPaystack(user, amount) {
  if (typeof PaystackPop === "undefined") {
    alert("❌ Paystack not loaded. Check your script.");
    return;
  }

  const handler = PaystackPop.setup({
    key: "pk_test_455e2470bf0f10994ed3c695186f5d8b70fb6433", // ✅ PUBLIC KEY ONLY
    email: user.email,
    amount: Number(amount) * 100, // Convert to kobo
    currency: "NGN",
    ref: `TH_${Date.now()}`, // Optional but recommended

    callback: function (response) {
      // ✅ Redirect to verification page
      window.location.href = `/public/verify.html?reference=${response.reference}`;
    },

    onClose: function () {
      alert("⚠️ Payment cancelled");
    },
  });

  handler.openIframe();
}

// ▶️ Button click handler
const payBtn = document.getElementById("payBtn");

if (payBtn) {
  payBtn.addEventListener("click", () => {
    payWithPaystack(user, booking.amount);
  });
} else {
  console.warn("⚠️ payBtn not found in DOM");
}
