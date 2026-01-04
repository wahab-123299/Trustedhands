const urlParams = new URLSearchParams(window.location.search);
const reference = urlParams.get("reference");

fetch(`https://trustedhands-backend.onrender.com/api/payments/verify?reference=${reference}`)
  .then(res => res.json())
  .then(data => {
    alert("Payment successful!");
    window.location.href = "/my-bookings.html";
  })
  .catch(() => alert("Verification failed"));
