const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const chatSocket = require('./socket/chatSocket');


// In server.js or app.js, at the top
console.log('MongoDB URI:', process.env.MONGODB_URI);

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

    // Initialize Socket.io with production-ready config
    const io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      // Production optimizations
      transports: ['websocket', 'polling'], // Fallback for older clients
      pingTimeout: 60000, // 60 seconds
      pingInterval: 25000, // 25 seconds
      // Connection limits
      maxHttpBufferSize: 1e6, // 1MB max message size
      perMessageDeflate: {
        threshold: 1024 // Compress messages > 1KB
      }
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
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });

    // ==========================================
    // ERROR HANDLING
    // ==========================================

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('❌ Unhandled Rejection:', err.message);
      console.error(err.stack);
      
      // Graceful shutdown
      server.close(() => {
        process.exit(1);
      });
      
      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        console.error('Force exiting due to unhandled rejection');
        process.exit(1);
      }, 10000);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err.message);
      console.error(err.stack);
      
      // Force immediate exit - uncaught exceptions leave app in undefined state
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

    // SIGTERM (e.g., from Kubernetes, Docker, PM2)
    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      
      // Close server (stop accepting new connections)
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        console.error('⚠️ Force closing server after timeout');
        process.exit(1);
      }, 30000);
    });

    // SIGINT (Ctrl+C)
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

    // Export for testing
    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Start the server
startServer();