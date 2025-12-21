import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const artisanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter artisan’s full name"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please enter artisan’s email"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please create a password"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    phone: {
      type: String,
      required: [true, "Please provide a phone number"],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    profession: {
      type: String,
      required: [true, "Please enter artisan’s skill category (e.g. Plumber, Electrician)"],
    },
    experience: {
      type: String,
      default: "0 years",
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    availability: {
      type: String,
      enum: ["Available", "Busy", "Offline"],
      default: "Available",
    },
    role: {
      type: String,
      default: "artisan",
    },
  },
  { timestamps: true }
);

// 🔒 Hash password before saving
artisanSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// 🔐 Compare entered password with hashed one
artisanSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Artisan = mongoose.model("Artisan", artisanSchema);
export default Artisan;