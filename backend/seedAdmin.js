const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

// Admin Schema (temporary for seeding)
const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, default: 'admin' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema, 'admins');

const seedAdmin = async () => {
  await connectDB();

  const adminData = {
    email: 'admin@trustedhand.org',
    password: await bcrypt.hash('AdminPass123!', 12), // Change this password!
    fullName: 'System Administrator',
    role: 'admin',
    isActive: true
  };

  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('⚠️ Admin already exists:', adminData.email);
      process.exit(0);
    }

    // Create admin
    const admin = await Admin.create(adminData);
    console.log('✅ Admin created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: AdminPass123! (change this after login)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();