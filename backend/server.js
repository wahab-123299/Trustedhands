import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import artisanRoutes from "./routes/artisanRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import adminJobRoutes from "./routes/adminJobRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import adminSettingsRoutes from "./routes/adminSettingsRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

import { paystackWebhook } from "./controllers/paymentController.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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
app.use(cors({
  origin: "*",// or your Netlify URL for stricter security
}));
app.use(express.json());

// ===== Routes =====
app.get("/", (req, res) => {
  res.send("🚀 Trusted Hand API is running...");
});

app.use("/api/auth", authRoutes);
app.use("/api/artisans", artisanRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminJobRoutes);
app.use("/api/admin", adminPaymentRoutes);
app.use("/api/admin", adminSettingsRoutes);

// ===== Error Handling =====
app.use(notFound);
app.use(errorHandler);

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

export default app;
