const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    let uri = process.env.MONGODB_URI;

    // CRITICAL: Ensure we use Trustedhands (capital T) - the actual database name
    if (uri.includes('/trustedhands') && !uri.includes('/Trustedhands')) {
      console.warn('⚠️ WARNING: URI has lowercase "trustedhands", fixing to "Trustedhands"');
      uri = uri.replace('/trustedhands', '/Trustedhands');
    }

    // If no database name at all, default to Trustedhands
    if (!uri.match(/\.mongodb\.net\/[a-zA-Z0-9_-]+/)) {
      console.warn('⚠️ WARNING: No database name in URI, appending /Trustedhands');
      uri = uri.replace('.mongodb.net/?', '.mongodb.net/Trustedhands?');
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
    
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`📁 Collections:`, collections.map(c => c.name));
    
    const userCount = await conn.connection.db.collection('users').countDocuments().catch(() => 0);
    console.log(`👥 Users in database: ${userCount}`);

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