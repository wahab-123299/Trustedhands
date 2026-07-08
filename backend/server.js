// backend/server.js
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const { startKeepAlive } = require('./utils/keepAlive');

const startServer = async () => {
  try {
    // ==========================================
    // ENV VALIDATION
    // ==========================================

    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined. Check .env file');
      process.exit(1);
    }

    console.log('🔧 MONGODB_URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

    const requiredVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missingRequired = requiredVars.filter(key => !process.env[key]);
    if (missingRequired.length > 0) {
      console.error('❌ Missing required env vars:', missingRequired.join(', '));
      process.exit(1);
    }

    console.log('✅ JWT_SECRET present');
    console.log('✅ JWT_REFRESH_SECRET present');

    // ==========================================
    // DATABASE CONNECTION
    // ==========================================

    await connectDB();
    console.log('✅ Database connection established');

    // MongoDB connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('🟢 MongoDB connected');
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🟡 MongoDB disconnected. Will auto-reconnect...');
    });

    mongoose.connection.on('error', (err) => {
      console.error('🔴 MongoDB error:', err.message);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🟢 MongoDB reconnected');
    });

    // Internal heartbeat to keep MongoDB connection alive
    setInterval(() => {
      if (mongoose.connection.readyState === 1) {
        mongoose.connection.db.admin().ping()
          .catch(err => console.error('💔 MongoDB heartbeat failed:', err.message));
      }
    }, 30000);

    // ==========================================
    // SOCKET.IO SETUP
    // ==========================================

    let io;
    try {
      const { init: initSocket } = require('./config/socket');
      const chatSocket = require('./socket/chatSocket');
      const server = http.createServer(app);
      io = initSocket(server);
      app.set('io', io);
      chatSocket(io);
      console.log('✅ Socket.io initialized');

      const PORT = process.env.PORT || 10000;
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 API URL: ${process.env.API_URL || `http://localhost:${PORT}`}`);
        console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'https://trustedhand.org'}`);
        console.log('');

        // ==========================================
        // START KEEP-ALIVE (Prevents Render from sleeping)
        // ==========================================
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        const keepAliveUrl = process.env.API_URL || `http://localhost:${PORT}`;
        if (isProduction) {
          startKeepAlive();
          console.log('📡 Keep-alive started — server will stay awake');
        } else {
          console.log('[KeepAlive] Skipped — development mode');
        }

        console.log('');
        console.log('📋 Available Routes:');
        console.log('   GET  /api/health          — Health check');
        console.log('   GET  /api/health/deep     — Deep health check (with DB ping)');
        console.log('   POST /api/auth/register');
        console.log('   POST /api/auth/login');
        console.log('   GET  /api/auth/me');
        console.log('   POST /api/auth/logout');
        console.log('   POST /api/auth/refresh');
        console.log('   GET  /api/auth/google     — Google OAuth');
        console.log('   GET  /api/auth/google/callback — Google OAuth callback');
        console.log('   GET  /api/auth/facebook   — Facebook OAuth');
        console.log('   GET  /api/auth/facebook/callback — Facebook OAuth callback');
      });
    } catch (socketError) {
      console.warn('⚠️  Socket.io initialization failed:', socketError.message);
      
      const PORT = process.env.PORT || 5000;
      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT} (without socket.io)`);
      });
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed.');
    process.exit(0);
  });
});

startServer();