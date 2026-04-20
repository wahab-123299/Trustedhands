const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const chatSocket = require('./socket/chatSocket');
const mongoose = require('mongoose');

// In server.js or app.js, at the top
console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.set('strictQuery', false);

// ==========================================
// SERVER INITIALIZATION
// ==========================================

/**
 * Start server with proper error handling and graceful shutdown
 */
const startServer = async () => {
  try {
    // Connect to database FIRST before starting server
    await connectDB();
    console.log('✅ Database connection established');

    // Create HTTP server
    const server = http.createServer(app);

    // ==========================================
    // FIXED: Socket.io CORS - Match app.js allowed origins
    // ==========================================
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://trustedhand.netlify.app',
      'https://trustedhands.onrender.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      // FIXED: Allow all transports with proper fallback
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6,
      perMessageDeflate: {
        threshold: 1024
      },
      // FIXED: Allow upgrade from polling to websocket
      allowUpgrades: true,
      upgradeTimeout: 10000
    });

    // Make io accessible to routes/controllers
    app.set('io', io);

    // Initialize chat socket handlers
    chatSocket(io);

    // Start server
    const PORT = process.env.PORT || 5000;
    const NODE_ENV = process.env.NODE_ENV || 'development';

    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
    });

    // ==========================================
    // ERROR HANDLING
    // ==========================================

    process.on('unhandledRejection', (err) => {
      console.error('❌ Unhandled Rejection:', err.message);
      console.error(err.stack);
      
      server.close(() => {
        process.exit(1);
      });
      
      setTimeout(() => {
        console.error('Force exiting due to unhandled rejection');
        process.exit(1);
      }, 10000);
    });

    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err.message);
      console.error(err.stack);
      
      server.close(() => {
        process.exit(1);
      });
      
      setTimeout(() => {
        console.error('Force exiting due to uncaught exception');
        process.exit(1);
      }, 10000);
    });

    // ==========================================
    // GRACEFUL SHUTDOWN HANDLERS
    // ==========================================

    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('⚠️ Force closing server after timeout');
        process.exit(1);
      }, 30000);
    });

    process.on('SIGINT', () => {
      console.log('👋 SIGINT received. Shutting down gracefully...');
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });

      setTimeout(() => {
        console.error('⚠️ Force closing server after timeout');
        process.exit(1);
      }, 30000);
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();