const mongoose = require('mongoose');

mongoose.set('strictQuery', false);


const connectDB = async () => {
  try {

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    let uri = process.env.MONGODB_URI;

    // CRITICAL FIX: Ensure database name is present
    // Check if URI has database name after .mongodb.net/
    const hasDbName = uri.match(/\.mongodb\.net\/[a-zA-Z0-9_-]+[^?]/);
    
    if (!hasDbName) {
      console.warn('⚠️ WARNING: No database name detected in MONGODB_URI');
      console.warn('⚠️ Appending /trustedhands to prevent defaulting to "test" database');
      // Handle both with and without trailing slash before query params
      uri = uri.replace('.mongodb.net/?', '.mongodb.net/trustedhands?');
      if (!uri.includes('/trustedhands')) {
        uri = uri.replace('.mongodb.net/', '.mongodb.net/trustedhands/');
      }
    }

    console.log('🔌 Connecting to MongoDB...');
    const safeUri = uri.replace(/:([^@]+)@/, ':****@');
    console.log('📍 URI:', safeUri);

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database Name: ${conn.connection.name}`);
    
    // List collections to verify
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`📁 Collections:`, collections.map(c => c.name));
    
    return conn;
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);

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
  console.log('🟡 Mongoose connection disconnected');
});


process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('👋 Mongoose connection closed');
  process.exit(0);
});



module.exports = connectDB;