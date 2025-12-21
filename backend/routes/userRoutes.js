import express from "express";
import { registerUser, authUser, getUserProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", authUser);

// Example of a protected route
router.get("/profile", protect, getUserProfile);

export default router;