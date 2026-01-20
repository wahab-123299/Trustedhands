import express from "express";
import protect from "../middleware/authMiddleware.js";
import roleMiddleware from "../middleware/roleMiddleware.js";
import {
  getAllJobs,
  updateJobStatus,
  deleteJob,
} from "../controllers/adminJobController.js";

const router = express.Router();

// Admin only
router.use(protect, roleMiddleware("admin"));

router.get("/jobs", getAllJobs);
router.put("/jobs/:id/status", updateJobStatus);
router.delete("/jobs/:id", deleteJob);

export default router;
