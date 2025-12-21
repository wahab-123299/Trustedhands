// backend/seeder.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Artisan from "./models/artisan.js";
import User from "./models/User.js";
import Job from "./models/Job.js";

dotenv.config();

// Connect to MongoDB
await connectDB();

const seedData = async () => {
  try {
    // Clear existing data
    await Artisan.deleteMany();
    await User.deleteMany();
    await Job.deleteMany();

    console.log("🧹 Old data cleared...");

    // Create Artisans
    const artisans = await Artisan.insertMany([
      {
        name: "John Ade",
        email: "johnade@example.com",
        password: "123456",
        phone: "08123456789",
        profession: "Plumber",
        experience: "5 years",
        bio: "Professional plumber with 5 years of residential experience.",
        address: "Lagos, Nigeria",
      },
      {
        name: "Mary Obi",
        email: "maryobi@example.com",
        password: "123456",
        phone: "08099887766",
        profession: "Electrician",
        experience: "3 years",
        bio: "Reliable electrician experienced in installations and maintenance.",
        address: "Abuja, Nigeria",
      },
      {
        name: "Emeka Joe",
        email: "emekajoe@example.com",
        password: "123456",
        phone: "08122233444",
        profession: "Carpenter",
        experience: "6 years",
        bio: "Specialist in modern carpentry and cabinet design.",
        address: "Enugu, Nigeria",
      },
    ]);

    // Create Users (Customers)
    const users = await User.insertMany([
      {
        name: "David Musa",
        email: "david@example.com",
        password: "123456",
        phone: "08011112222",
        address: "Kano, Nigeria",
        role: "customer",
      },
      {
        name: "Grace Ade",
        email: "grace@example.com",
        password: "123456",
        phone: "08033334444",
        address: "Ibadan, Nigeria",
        role: "customer",
      },
    ]);

    // Create Jobs
    const jobs = await Job.insertMany([
      {
        title: "Fix leaking pipe",
        description: "Water leaking in bathroom needs urgent fixing.",
        location: "Lagos",
        budget: 8000,
        user: users[0]._id,
        artisan: artisans[0]._id,
        status: "Completed",
      },
      {
        title: "Install ceiling fan",
        description: "Need help installing ceiling fan in bedroom.",
        location: "Abuja",
        budget: 5000,
        user: users[1]._id,
        artisan: artisans[1]._id,
      },
      {
        title: "Build kitchen cabinet",
        description: "Looking for quality woodwork for my kitchen.",
        location: "Enugu",
        budget: 15000,
        user: users[0]._id,
        artisan: artisans[2]._id,
      },
    ]);

    console.log("✅ Sample data seeded successfully!");
    process.exit();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedData();
