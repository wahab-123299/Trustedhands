import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    artisan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artisan",
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
    },
    amount: {
      type: Number,
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: Date,
    paymentMethod: String,
    paymentReference: String,
    status: {
      type: String,
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

/* 🚨 THIS MUST EXIST ONLY ONCE */
const Booking =
  mongoose.models.Booking ||
  mongoose.model("Booking", bookingSchema);

export default Booking;
