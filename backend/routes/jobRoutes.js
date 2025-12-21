import express from "express";
import Job from "../models/Job.js";
import {
  createJob,
  getAllJobs,
  getUserJobs,
  getArtisanJobs,
  acceptJob,
  completeJob,
  setJobPrice,
  updateJobPrice,
} from "../controllers/jobController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* 
  🔹 PUBLIC ROUTES 
  (anyone can see jobs and job details)
*/

// GET all jobs (public)
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.find().populate("artisan").populate("customer");
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching jobs" });
  }
});

// GET single job by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("artisan")
      .populate("customer");
    if (job) {
      res.json(job);
    } else {
      res.status(404).json({ message: "Job not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error fetching job" });
  }
});

/* 
  🔒 PROTECTED ROUTES 
  (require user to be authenticated)
*/

router.post("/", protect, createJob);
router.get("/my", protect, getUserJobs);
router.get("/assigned", protect, getArtisanJobs);
router.put("/:id/accept", protect, acceptJob);
router.put("/:id/complete", protect, completeJob);
router.put("/:id/price", protect, setJobPrice);
router.put("/update-price/:id", protect, updateJobPrice);

export default router;
