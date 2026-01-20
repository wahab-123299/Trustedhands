import asyncHandler from "express-async-handler";
import Artisan from "../models/artisan.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

/**
 * @desc    Register a new artisan
 * @route   POST /api/artisans/register
 * @access  Public
 */
export const registerArtisan = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    profession,
    experience,
    bio,
    address,
  } = req.body;

  // Validate
  if (!name || !email || !password || !profession) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }

  // Check if artisan exists
  const artisanExists = await Artisan.findOne({ email });
  if (artisanExists) {
    res.status(400);
    throw new Error("Artisan already exists");
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create artisan
  const artisan = await Artisan.create({
    name,
    email,
    password: hashedPassword,
    phone,
    profession,
    experience,
    bio,
    address,
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
 * @desc    Authenticate artisan & get token
 * @route   POST /api/artisans/login
 * @access  Public
 */
export const authArtisan = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const artisan = await Artisan.findOne({ email });

  if (!artisan) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const isMatch = await bcrypt.compare(password, artisan.password);

  if (!isMatch) {
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
 * @desc    Search artisans by skill/location
 * @route   GET /api/artisans/search?skill=&location=
 * @access  Public
 */
export const searchArtisans = asyncHandler(async (req, res) => {
  const { skill, location } = req.query;

  const query = {};

  if (skill) {
    query.profession = { $regex: skill, $options: "i" };
  }

  if (location) {
    query.address = { $regex: location, $options: "i" };
  }

  const artisans = await Artisan.find(query).select("-password");
  res.json(artisans);
});