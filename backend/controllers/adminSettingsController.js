import asyncHandler from "express-async-handler";
import Admin from "../models/admin.js";

/**
 * GET ADMIN PROFILE
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id).select("-password");

  if (!admin) {
    res.status(404);
    throw new Error("Admin not found");
  }

  res.json(admin);
});

/**
 * UPDATE PROFILE
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  admin.name = req.body.name || admin.name;
  admin.email = req.body.email || admin.email;

  const updated = await admin.save();
  res.json(updated);
});

/**
 * UPDATE SERVICE FEE
 */
export const updateServiceFee = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  admin.serviceFee = req.body.serviceFee;
  await admin.save();

  res.json({ message: "Service fee updated", serviceFee: admin.serviceFee });
});

/**
 * UPDATE NOTIFICATIONS
 */
export const updateNotifications = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);

  admin.notifications.email = req.body.email;
  admin.notifications.sms = req.body.sms;

  await admin.save();
  res.json({ message: "Notification preferences updated" });
});

/**
 * CHANGE PASSWORD
 */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const admin = await Admin.findById(req.user._id);

  if (!(await admin.matchPassword(oldPassword))) {
    res.status(401);
    throw new Error("Current password incorrect");
  }

  admin.password = newPassword;
  await admin.save();

  res.json({ message: "Password changed successfully" });
});
