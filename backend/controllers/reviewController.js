import Review from "../models/review.js";
import Booking from "../models/booking.js";

export const addReview = async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  const booking = await Booking.findById(bookingId);

  if (!booking || booking.status !== "completed") {
    return res.status(400).json({ message: "Booking not completed" });
  }

  const review = await Review.create({
    booking: bookingId,
    artisan: booking.artisan,
    customer: req.user._id,
    rating,
    comment,
  });

  res.status(201).json(review);
};

export const getArtisanReviews = async (req, res) => {
  const reviews = await Review.find({ artisan: req.params.id })
    .populate("customer", "name");

  res.json(reviews);
};
