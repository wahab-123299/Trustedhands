import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import artisanRoutes from "./routes/artisanRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import reviewRoutes from "./routes/review.js";
import paymentRoutes from "./routes/paymentRoutes.js";

import { paystackWebhook } from "./controllers/paymentController.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// Load env variables
dotenv.config();

// Connect DB
connectDB();

// Init app
const app = express();

/* ===============================
   PAYSTACK WEBHOOK (RAW BODY)
   MUST BE BEFORE express.json()
================================ */
app.post(
  "/api/payments/paystack/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook
);

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Routes =====
app.get("/", (req, res) => {
  res.send("🚀 Trusted Hand API is running...");
});

app.use("/api/artisans", artisanRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payments", paymentRoutes);

// ===== Error Handling =====
app.use(notFound);
app.use(errorHandler);

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

export default app;
