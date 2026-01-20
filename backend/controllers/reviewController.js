import Review from "../models/review.js";
import Artisan from "../models/artisan.js";

/* ===============================
   GET REVIEWS BY ARTISAN
   GET /api/reviews/:artisanId
=============================== */
export const getArtisanReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      artisan: req.params.artisanId,
    }).populate("customer", "name");

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

/* ===============================
   CREATE REVIEW
   POST /api/reviews/:artisanId
=============================== */
export const createReview = async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    // ❌ Prevent duplicate reviews
    const existingReview = await Review.findOne({
      artisan: req.params.artisanId,
      customer: req.user._id,
    });

    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You already reviewed this artisan" });
    }

    // ✅ Create review
    const review = await Review.create({
      artisan: req.params.artisanId,
      customer: req.user._id,
      rating,
      comment,
    });

    // 🔄 Recalculate artisan rating
    const reviews = await Review.find({
      artisan: req.params.artisanId,
    });

    const avgRating =
      reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

    await Artisan.findByIdAndUpdate(req.params.artisanId, {
      rating: avgRating.toFixed(1),
      numReviews: reviews.length,
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: "Review creation failed" });
  }
};