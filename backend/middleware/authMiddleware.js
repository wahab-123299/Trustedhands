import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Artisan from "../models/artisan.js";

/**
 * @desc    Protect routes (Users & Artisans)
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try User first
      let account = await User.findById(decoded.id).select("-password");

      // If not user, try artisan
      if (!account) {
        account = await Artisan.findById(decoded.id).select("-password");
      }

      if (!account) {
        res.status(401);
        throw new Error("Account not found");
      }

      req.user = account;
      next();
    } catch (error) {
      console.error("Auth error:", error.message);
      res.status(401);
      throw new Error("Not authorized, token invalid or expired");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }
});

/**
 * @desc    Admin-only access
 */
export const adminOnly = (req, res, next) => {
  if (req.user?.role === "admin") {
    next();
  } else {
    res.status(403);
    throw new Error("Access denied: Admins only");
  }
};