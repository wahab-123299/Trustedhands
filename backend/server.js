// server.js
const http = require('http');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');

const startServer = async () => {
  try {
    // Verify dotenv loaded properly
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined. Check that your .env file exists at:');
      console.error('   C:\\Users\\HP\\Documents\\GitHub\\Trustedhands\\backend\\.env');
      console.error('   And that it contains: MONGODB_URI=mongodb://localhost:27017/TrustedHands');
      process.exit(1);
    }

    console.log('🔧 MONGODB_URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

    // Verify critical env vars
    const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missingRequired = requiredVars.filter(key => !process.env[key]);
    if (missingRequired.length > 0) {
      console.error('❌ Missing required env vars:', missingRequired.join(', '));
      console.error('   Your .env file must contain JWT_SECRET and JWT_REFRESH_SECRET');
      process.exit(1);
    }

    console.log('✅ JWT_SECRET present');
    console.log('✅ JWT_REFRESH_SECRET present');

    await connectDB();
    console.log('✅ Database connection established');

    // Initialize socket.io (optional)
    let io;
    try {
      const { init: initSocket } = require('./config/socket');
      const chatSocket = require('./socket/chatSocket');
      const server = http.createServer(app);
      io = initSocket(server);
      app.set('io', io);
      chatSocket(io);
      console.log('✅ Socket.io initialized');

      const PORT = process.env.PORT || 5000;
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'https://trustedhand.org'}`);
        console.log('');
        console.log('📋 Available Auth Routes:');
        console.log('   POST /api/auth/register');
        console.log('   POST /api/auth/login');
        console.log('   GET  /api/auth/me');
        console.log('   POST /api/auth/logout');
        console.log('   POST /api/auth/refresh');
      });
    } catch (socketError) {
      console.warn('⚠️  Socket.io initialization failed:', socketError.message);
      console.warn('   Server will continue without real-time features.');

      const PORT = process.env.PORT || 5000;
      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (without socket.io)`);
        console.log(`📡 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

startServer();