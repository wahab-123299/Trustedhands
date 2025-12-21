import express from "express";
import { addReview, getArtisanReviews } from "../controllers/reviewController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Add a review (customer only)
router.post("/add", protect, addReview);

// Get all reviews for a specific artisan
router.get("/artisan/:id", getArtisanReviews);

export default router;
