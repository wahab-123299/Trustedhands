import asyncHandler from "express-async-handler";
import Artisan from "../models/artisan.js";
import Job from "../models/Job.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

/* registerArtisan */
/* authArtisan */
/* getArtisanProfile */
/* searchArtisans */

/**
 * @desc    Get active jobs for logged-in artisan
 * @route   GET /api/artisans/jobs/active
 * @access  Private
 */
export const getActiveJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find({
    artisan: req.user._id,
    status: "active",
  });

  res.json(jobs);
});
