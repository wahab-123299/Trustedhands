import express from "express";
import {
  getAllPayments,
  updatePaymentStatus,
} from "../controllers/adminPaymentController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/payments", protect, admin, getAllPayments);
router.put("/payments/:id", protect, admin, updatePaymentStatus);

export default router;
