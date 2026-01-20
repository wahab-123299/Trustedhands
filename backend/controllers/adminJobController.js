import asyncHandler from "express-async-handler";
import Booking from "../models/booking.js";

/* ===============================
   GET ALL JOBS
================================ */
export const getAllJobs = asyncHandler(async (req, res) => {
  const jobs = await Booking.find()
    .populate("customer", "name email")
    .populate("artisan", "name profession")
    .sort({ createdAt: -1 });

  res.json(jobs);
});

/* ===============================
   UPDATE JOB STATUS
================================ */
export const updateJobStatus = asyncHandler(async (req, res) => {
  const job = await Booking.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  job.status = req.body.status;
  await job.save();

  res.json({ message: "Job status updated", job });
});

/* ===============================
   DELETE JOB
================================ */
export const deleteJob = asyncHandler(async (req, res) => {
  const job = await Booking.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  await job.deleteOne();
  res.json({ message: "Job deleted successfully" });
});
