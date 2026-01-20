import express from "express";
import {
  addReview,
  getArtisanReviews,
} from "../controllers/reviewController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a review (logged-in customer)
router.post("/:artisanId", protect, addReview);

// Get all reviews for an artisan
router.get("/:artisanId", getArtisanReviews);

export default router;
