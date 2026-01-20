import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ===============================
// Generate JWT Token
// ===============================
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ===============================
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
// ===============================
export const registerUser = async (req, res) => {
  const { fullname, email, password, role } = req.body;

  // Validate input
  if (!fullname || !email || !password || !role) {
    return res.status(400).json({ message: "Please fill all fields" });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      fullname,
      email,
      password: hashedPassword,
      role,
    });

    // Send response
    res.status(201).json({
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===============================
// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// ===============================
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ message: "Please provide email and password" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};