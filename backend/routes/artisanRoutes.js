import express from "express";
import { registerArtisan, authArtisan, getArtisanProfile, searchArtisans } from "../controllers/artisanController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

// Artisan auth
router.post("/register", registerArtisan);
router.post("/login", authArtisan);

// Protected artisan profile
router.get("/profile", protect, getArtisanProfile);

// Search artisans (public)
router.get("/search", searchArtisans);

export default router;
