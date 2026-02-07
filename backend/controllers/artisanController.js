import asyncHandler from "express-async-handler";
import Artisan from "../models/artisan.js";
import Job from "../models/Job.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

/**
 * REGISTER ARTISAN
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

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

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
 * LOGIN ARTISAN
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

/**
 * GET ARTISAN PROFILE
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
 * UPDATE ARTISAN PROFILE
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
  res.json(updatedArtisan);
});

/**
 * GET ACTIVE JOBS
 */
export const getActiveJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({
    artisan: req.user._id,
    status: "active",
  }).sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * JOB HISTORY
 */
export const getJobHistory = asyncHandler(async (req, res) => {
  const jobs = await Job.find({
    artisan: req.user._id,
    status: "completed",
  }).sort({ createdAt: -1 });

  res.json(jobs);
});

/**
 * MARK JOB AS COMPLETE
 */
export const markJobComplete = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  job.status = "completed";
  await job.save();

  res.json({ message: "Job marked as completed" });
});
