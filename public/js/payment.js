// Get stored data
const user = JSON.parse(localStorage.getItem("userInfo"));
const booking = JSON.parse(localStorage.getItem("bookingInfo"));

if (!user || !booking) {
  alert("Payment data missing");
}

// PAYSTACK FUNCTION
const payWithPaystack = (user, amount) => {
  const handler = PaystackPop.setup({
    key: "pk_test_455e2470bf0f10994ed3c695186f5d8b70fb6433", // PUBLIC KEY
    email: user.email,
    amount: amount * 100,
    currency: "NGN",

    callback: function (response) {
      // Redirect after successful payment
      window.location.href = `/verify.html?reference=${response.reference}`;
    },

    onClose: function () {
      alert("Payment cancelled");
    },
  });

  handler.openIframe();
};

// Button click
document.getElementById("payBtn").addEventListener("click", () => {
  payWithPaystack(user, booking.amount);
});
