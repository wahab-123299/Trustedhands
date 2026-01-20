import express from "express";
import {
  getAdminProfile,
  updateAdminProfile,
  updateServiceFee,
  updateNotifications,
  changeAdminPassword,
} from "../controllers/adminSettingsController.js";

import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", protect, admin, getAdminProfile);
router.put("/profile", protect, admin, updateAdminProfile);

router.put("/settings/fee", protect, admin, updateServiceFee);
router.put("/settings/notifications", protect, admin, updateNotifications);

router.put("/change-password", protect, admin, changeAdminPassword);

export default router;
