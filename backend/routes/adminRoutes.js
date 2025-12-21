import express from "express";
import {
  getAllArtisans,
  getAllUsers,
  getAllJobs,
  updateJobPrice,
  deleteArtisan,
  getAdminStats,
} from "../controllers/adminController.js";

const router = express.Router();

router.get("/artisans", getAllArtisans);
router.get("/users", getAllUsers);
router.get("/jobs", getAllJobs);
router.put("/job/:id/price", updateJobPrice);
router.delete("/artisan/:id", deleteArtisan);
router.get("/stats", getAdminStats);

export default router;
