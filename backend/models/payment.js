import { Schema, model } from "mongoose";

const bookingSchema = new Schema(
  {
    artisan: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    bookingDate: {
      type: Date,
      required: true,
    },

    details: {
      type: String,
    },

    // ======================
    // BOOKING STATUS
    // ======================
    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "cancelled"],
      default: "pending",
    },

    // ======================
    // PAYMENT FIELDS (REAL)
    // ======================
    amount: {
      type: Number,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded"],
      default: "unpaid",
    },

    paymentReference: {
      type: String,
    },

    paymentMethod: {
      type: String,
      enum: ["paystack", "flutterwave"],
    },

    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default model("Booking", bookingSchema);
