const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    const uri = process.env.MONGODB_URI.trim();

    console.log('🔌 Connecting to MongoDB...');
    const safeUri = uri.replace(/:([^@]+)@/, ':****@');
    console.log('📍 URI:', safeUri);

    // ✅ ADDED: Connection resilience options
    const mongooseOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    };

    const conn = await mongoose.connect(uri, mongooseOptions);

    console.log(`✅ MongoDB Connected`);
    console.log(`📊 Database Name: ${conn.connection.name}`);

    return conn;

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('🟡 Mongoose connection disconnected — will auto-reconnect');
});

mongoose.connection.on('reconnected', () => {
  console.log('🟢 MongoDB reconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 Mongoose connection closed');
  process.exit(0);
});

module.exports = connectDB;