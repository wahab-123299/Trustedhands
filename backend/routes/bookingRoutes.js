const express = require("express");
const router = express.Router();

const Booking = require("../models/booking");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

/**
 * ================================
 * CREATE BOOKING (CUSTOMER ONLY)
 * POST /api/bookings
 * ================================
 */
router.post("/", protect, async (req, res) => {
  try {
    // Only customers can book
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can create bookings",
      });
    }

    const { artisan, location, bookingDate, details } = req.body;

    // Validate input
    if (!artisan || !location || !bookingDate) {
      return res.status(400).json({
        message: "Artisan, location and booking date are required",
      });
    }

    // Check artisan exists
    const artisanUser = await User.findById(artisan);
    if (!artisanUser || artisanUser.role !== "artisan") {
      return res.status(404).json({
        message: "Artisan not found",
      });
    }

    // Optional: check artisan status
    if (artisanUser.status && artisanUser.status !== "Active") {
      return res.status(400).json({
        message: "Artisan is not available",
      });
    }

    // Create booking
    const newBooking = await Booking.create({
      artisan,
      customer: req.user._id, // 🔒 secure
      location,
      bookingDate,
      details,
      status: "pending",
      isPaid: false,
    });

    res.status(201).json({
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error while creating booking",
    });
  }
});

--

/**
 * ================================
 * GET MY BOOKINGS (CUSTOMER)
 * GET /api/bookings/my
 * ================================
 */
router.get("/my", protect, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const bookings = await Booking.find({ customer: req.user._id })
      .populate("artisan", "name skill location")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching bookings",
    });
  }
});

/**
 * ================================
 * GET ALL BOOKINGS (ADMIN ONLY)
 * GET /api/bookings
 * ================================
 */
/* ================================
*/
router.get("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Admin access only",
      });
    }

    const bookings = await Booking.find()
      .populate("artisan", "name skill")
      .populate("customer", "name email")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error fetching bookings",
    });
  }
});

module.exports = router;
