import User from "../models/User.js";
import Artisan from "../models/artisan.js";
import Job from "../models/Job.js";

// 🧩 Get all artisans
export const getAllArtisans = async (req, res) => {
  try {
    const artisans = await Artisan.find().sort({ createdAt: -1 });
    res.json(artisans);
  } catch (error) {
    console.error("Error fetching artisans:", error);
    res.status(500).json({ message: "Server error while fetching artisans" });
  }
};

// 👥 Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error while fetching users" });
  }
};

// 💼 Get all jobs
export const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .populate("user", "name email")
      .populate("artisan", "name email")
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ message: "Server error while fetching jobs" });
  }
};

// 💰 Update job price
export const updateJobPrice = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const { agreedPrice, priceStatus } = req.body;

    if (agreedPrice) job.agreedPrice = agreedPrice;
    if (priceStatus) job.priceStatus = priceStatus;

    const updatedJob = await job.save();
    res.json({ message: "Job price updated successfully", updatedJob });
  } catch (error) {
    console.error("Error updating job price:", error);
    res.status(500).json({ message: "Server error while updating job price" });
  }
};

// ❌ Delete an artisan
export const deleteArtisan = async (req, res) => {
  try {
    const artisan = await Artisan.findById(req.params.id);

    if (!artisan) {
      return res.status(404).json({ message: "Artisan not found" });
    }

    await artisan.deleteOne();
    res.json({ message: "Artisan deleted successfully" });
  } catch (error) {
    console.error("Error deleting artisan:", error);
    res.status(500).json({ message: "Server error while deleting artisan" });
  }
};

// 📊 Admin dashboard statistics
export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalArtisans = await Artisan.countDocuments();
    const totalJobs = await Job.countDocuments();
    const completedJobs = await Job.countDocuments({ status: "Completed" });
    const pendingJobs = await Job.countDocuments({ status: "Pending" });
    const totalRevenue = await Job.aggregate([
      { $match: { paymentStatus: "Paid" } },
      { $group: { _id: null, total: { $sum: "$agreedPrice" } } },
    ]);

    res.json({
      totalUsers,
      totalArtisans,
      totalJobs,
      completedJobs,
      pendingJobs,
      totalRevenue: totalRevenue[0]?.total || 0,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Server error while fetching stats" });
  }
};