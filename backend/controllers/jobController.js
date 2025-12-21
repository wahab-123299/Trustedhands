import asyncHandler from "express-async-handler";
import Job from "../models/Job.js";

/**
 * @desc    Create new job (Customer)
 * @route   POST /api/jobs
 * @access  Private
 */
export const createJob = asyncHandler(async (req, res) => {
  const { title, description, location, budget } = req.body;

  if (!title || !description || !location || !budget) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const job = await Job.create({
    user: req.user._id,
    title,
    description,
    location,
    budget,
  });

  res.status(201).json(job);
});

/**
 * @desc    Get all jobs (Admin only)
 * @route   GET /api/jobs
 * @access  Private/Admin
 */
export const getAllJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find()
    .populate("user", "name email")
    .populate("artisan", "name email profession");

  res.json(jobs);
});

/**
 * @desc    Get jobs created by current user (Customer)
 * @route   GET /api/jobs/my
 * @access  Private
 */
export const getUserJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ user: req.user._id })
    .populate("artisan", "name profession")
    .sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * @desc    Get jobs assigned to current artisan
 * @route   GET /api/jobs/assigned
 * @access  Private/Artisan
 */
export const getArtisanJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({ artisan: req.user._id })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * @desc    Artisan accepts a job
 * @route   PUT /api/jobs/:id/accept
 * @access  Private/Artisan
 */
export const acceptJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  if (job.status !== "Pending") {
    res.status(400);
    throw new Error("Job cannot be accepted");
  }

  job.status = "Accepted";
  job.artisan = req.user._id;

  await job.save();
  res.json({ message: "Job accepted successfully", job });
});

/**
 * @desc    Mark job as completed
 * @route   PUT /api/jobs/:id/complete
 * @access  Private/Artisan
 */
export const completeJob = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  if (job.status === "Completed") {
    res.status(400);
    throw new Error("Job is already completed");
  }

  job.status = "Completed";
  job.dateCompleted = new Date();

  await job.save();
  res.json({ message: "Job marked as completed", job });
});

/**
 * @desc    Approve or set job price (Admin or Artisan)
 * @route   PUT /api/jobs/:id/price
 * @access  Private/Admin or Artisan
 */
export const setJobPrice = asyncHandler(async (req, res) => {
  const { agreedPrice } = req.body;
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  if (!agreedPrice || agreedPrice <= 0) {
    res.status(400);
    throw new Error("Please enter a valid price");
  }

  job.agreedPrice = agreedPrice;
  job.priceStatus = "Approved";

  await job.save();
  res.json({ message: "Job price approved successfully", job });
});

/**
 * @desc    Update job agreed price (Admin only)
 * @route   PUT /api/jobs/:id/update-price
 * @access  Private/Admin
 */
export const updateJobPrice = asyncHandler(async (req, res) => {
  const { agreedPrice } = req.body;

  const job = await Job.findByIdAndUpdate(
    req.params.id,
    { agreedPrice, priceStatus: "Approved" },
    { new: true }
  );

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  res.json({ message: "Agreed price updated successfully", job });
});

/**
 * @desc    Get all jobs (Public or Admin)
 * @route   GET /api/jobs/all
 * @access  Public
 */
export const getJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find().sort({ createdAt: -1 });
  res.json(jobs);
});
