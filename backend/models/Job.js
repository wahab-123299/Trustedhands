import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    artisan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artisan",
    },
    title: {
      type: String,
      required: [true, "Please add a job title"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please describe the job"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Please enter location"],
    },
    // Proposed customer budget
    budget: {
      type: Number,
      required: [true, "Please add a proposed budget"],
      min: [0, "Budget cannot be negative"],
    },
    // Final agreed amount
    agreedPrice: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
    },
    // Job pricing approval flow
    priceStatus: {
      type: String,
      enum: ["Pending", "Approved", "Finalized"],
      default: "Pending",
    },
    // Overall job progress
    status: {
      type: String,
      enum: ["Pending", "Accepted", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    dateRequested: {
      type: Date,
      default: Date.now,
    },
    dateCompleted: {
      type: Date,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
    // Payment tracking
    paymentStatus: {
      type: String,
      enum: ["Unpaid", "Paid", "Refunded"],
      default: "Unpaid",
    },
    transactionId: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Job = mongoose.model("Job", jobSchema);

export default Job;