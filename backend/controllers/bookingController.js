import Booking from "../models/booking.js";

export const getMyBookings = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "customer") {
      filter.customer = req.user._id;
    } 
    else if (req.user.role === "artisan") {
      filter.artisan = req.user._id;
    } 
    else {
      return res.status(403).json({ message: "Access denied" });
    }

    const bookings = await Booking.find(filter)
      .populate("customer", "name email")
      .populate("artisan", "name skill")
      .sort({ createdAt: -1 });

    res.status(200).json(bookings);

  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
