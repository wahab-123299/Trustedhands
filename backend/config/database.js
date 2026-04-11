const mongoose = require('mongoose');

/**
 * Connect to MongoDB with enhanced error handling and event listeners
 * @returns {Promise<typeof mongoose>} Mongoose connection instance
 */
const connectDB = async () => {
  try {
    // Validate environment variable exists
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
    
    return conn;
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    
    // Exit with failure (1) - container orchestrators will restart
    process.exit(1);
  }
};

// ==========================================
// MONGOOSE CONNECTION EVENT LISTENERS
// ==========================================

// Successfully connected
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connection established');
});

// Connection error (after initial connection)
mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err.message);
});

// Disconnected
mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose connection disconnected');
});

// Application termination - graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 Mongoose connection closed through app termination');
  process.exit(0);
});

// Handle uncaught promise rejections for database operations
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  mongoose.connection.close(() => process.exit(1));
});

module.exports = connectDB;