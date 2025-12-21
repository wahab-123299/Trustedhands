import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Artisan from "../models/artisan.js";

/**
 * @desc    Protect routes (for both Users and Artisans)
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check for Bearer token
  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Try to find a User first
      let user = await User.findById(decoded.id).select("-password");

      // If not found in User, check Artisan collection
      if (!user) {
        user = await Artisan.findById(decoded.id).select("-password");
      }

      // If still not found
      if (!user) {
        res.status(401);
        throw new Error("User or Artisan not found");
      }

      // Attach user data to request object
      req.user = user;

      next();
    } catch (error) {
      console.error("Token verification failed:", error.message);
      res.status(401);
      throw new Error("Not authorized, invalid or expired token");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, token missing");
  }
});
