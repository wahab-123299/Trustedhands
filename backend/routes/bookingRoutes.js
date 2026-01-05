const express = require("express");
const router = express.Router();
const Booking = require("../models/booking");
const BookingController = require("../controllers/bookingController");
const protect = require("../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// POST - Create a new booking
router.post("/", async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    await newBooking.save();
    res.status(201).json({ message: "Booking saved successfully", data: newBooking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error saving booking" });
  }
});

// GET - Fetch all bookings
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching bookings" });
  }
});

module.exports = router;
