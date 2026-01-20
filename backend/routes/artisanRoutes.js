import express from "express";
import {
  registerArtisan,
  authArtisan,
  getArtisanProfile,
  updateArtisanProfile,
  getActiveJobs,
  getJobHistory,
  markJobComplete
} from "../controllers/artisanController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Auth
router.post("/register", registerArtisan);
router.post("/login", authArtisan);

// Profile
router.get("/profile", protect, getArtisanProfile);
router.put("/profile", protect, updateArtisanProfile);

// Jobs
router.get("/jobs/active", protect, getActiveJobs);
router.get("/jobs/history", protect, getJobHistory);
router.put("/jobs/:id/complete", protect, markJobComplete);

export default router;