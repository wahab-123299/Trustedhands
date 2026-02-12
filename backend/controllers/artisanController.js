import asyncHandler from "express-async-handler";
import Artisan from "../models/artisan.js";
import Job from "../models/Job.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

/* =======================================================
   AUTH
======================================================= */

/**
 * @desc    Register artisan
 * @route   POST /api/artisans/register
 * @access  Public
 */
export const registerArtisan = asyncHandler(async (req, res) => {
  const { name, email, password, profession } = req.body;

  if (!name || !email || !password || !profession) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }

  const artisanExists = await Artisan.findOne({ email });
  if (artisanExists) {
    res.status(400);
    throw new Error("Artisan already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const artisan = await Artisan.create({
    name,
    email,
    password: hashedPassword,
    profession,
  });

  res.status(201).json({
    _id: artisan._id,
    name: artisan.name,
    email: artisan.email,
    profession: artisan.profession,
    token: generateToken(artisan._id),
  });
});

/**
 * @desc    Login artisan
 * @route   POST /api/artisans/login
 * @access  Public
 */
export const authArtisan = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const artisan = await Artisan.findOne({ email });

  if (!artisan || !(await bcrypt.compare(password, artisan.password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    _id: artisan._id,
    name: artisan.name,
    email: artisan.email,
    profession: artisan.profession,
    token: generateToken(artisan._id),
  });
});

/* =======================================================
   PROFILE
======================================================= */

/**
 * @desc    Get artisan profile
 * @route   GET /api/artisans/profile
 * @access  Private
 */
export const getArtisanProfile = asyncHandler(async (req, res) => {
  const artisan = await Artisan.findById(req.user._id).select("-password");

  if (!artisan) {
    res.status(404);
    throw new Error("Artisan not found");
  }

  res.json(artisan);
});

/**
 * @desc    Update artisan profile
 * @route   PUT /api/artisans/profile
 * @access  Private
 */
export const updateArtisanProfile = asyncHandler(async (req, res) => {
  const artisan = await Artisan.findById(req.user._id);

  if (!artisan) {
    res.status(404);
    throw new Error("Artisan not found");
  }

  artisan.name = req.body.name || artisan.name;
  artisan.phone = req.body.phone || artisan.phone;
  artisan.bio = req.body.bio || artisan.bio;
  artisan.address = req.body.address || artisan.address;
  artisan.profession = req.body.profession || artisan.profession;
  artisan.experience = req.body.experience || artisan.experience;

  const updatedArtisan = await artisan.save();

  res.json({
    _id: updatedArtisan._id,
    name: updatedArtisan.name,
    email: updatedArtisan.email,
    profession: updatedArtisan.profession,
    phone: updatedArtisan.phone,
    bio: updatedArtisan.bio,
    address: updatedArtisan.address,
    experience: updatedArtisan.experience,
  });
});

/* =======================================================
   JOBS
======================================================= */

/**
 * @desc    Get active jobs
 * @route   GET /api/artisans/jobs/active
 * @access  Private
 */
export const getActiveJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({
    artisan: req.user._id,
    status: "active",
  }).sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * @desc    Get completed jobs (history)
 * @route   GET /api/artisans/jobs/history
 * @access  Private
 */
export const getJobHistory = asyncHandler(async (req, res) => {
  const jobs = await Job.find({
    artisan: req.user._id,
    status: "completed",
  }).sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * @desc    Mark job as completed
 * @route   PUT /api/artisans/jobs/:id/complete
 * @access  Private
 */
export const markJobComplete = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  // Ensure artisan owns this job
  if (job.artisan.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to update this job");
  }

  job.status = "completed";
  await job.save();

  res.json({ message: "Job marked as completed" });
});
