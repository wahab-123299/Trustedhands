import axios from "axios";
import crypto from "crypto";
import Payment from "../models/payment.js";
import Booking from "../models/booking.js";

/* =========================
   INITIALIZE PAYMENT
========================= */
export const initializePayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId).populate("user");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.isPaid) {
      return res.status(400).json({ message: "Booking already paid" });
    }

    const reference = `TH-${Date.now()}-${booking._id}`;

    await Payment.create({
      booking: booking._id,
      user: booking.user._id,
      amount: booking.amount,
      reference,
      status: "pending",
    });

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: booking.user.email,
        amount: booking.amount * 100,
        reference,
        metadata: { bookingId: booking._id },
        callback_url: `${process.env.BASE_URL}/payment-success.html`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json(response.data.data);
  } catch (error) {
    res.status(500).json({ message: "Payment initialization failed" });
  }
};

/* =========================
   VERIFY PAYMENT (MANUAL)
========================= */
export const verifyPayment = async (req, res) => {
  const { reference } = req.query;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data.data;

    if (data.status !== "success") {
      return res.status(400).json({ message: "Payment not successful" });
    }

    const booking = await Booking.findById(data.metadata.bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.isPaid = true;
    booking.paidAt = Date.now();
    booking.paymentMethod = "paystack";
    booking.paymentReference = reference;

    await booking.save();

    await Payment.findOneAndUpdate(
      { reference },
      { status: "success" }
    );

    res.json({ message: "Payment verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Payment verification failed" });
  }
};

/* =========================
   PAYSTACK WEBHOOK
========================= */
export const paystackWebhook = async (req, res) => {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.sendStatus(401);
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const { bookingId } = event.data.metadata;
    const reference = event.data.reference;

    await Booking.findByIdAndUpdate(bookingId, {
      isPaid: true,
      paidAt: Date.now(),
      paymentMethod: "paystack",
      paymentReference: reference,
    });

    await Payment.findOneAndUpdate(
      { reference },
      { status: "success" }
    );
  }

  res.sendStatus(200);
};
