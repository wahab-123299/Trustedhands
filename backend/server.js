const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const chatSocket = require('./socket/chatSocket');
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

mongoose.set('strictQuery', false);

const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ Database connection established');

    const server = http.createServer(app);

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
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6,
      perMessageDeflate: {
        threshold: 1024
      },
      allowUpgrades: true,
      upgradeTimeout: 10000
    });

    app.set('io', io);
    chatSocket(io);

    const PORT = process.env.PORT || 5000;
    const NODE_ENV = process.env.NODE_ENV || 'development';

    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
      console.log(`🔗 FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    });

    process.on('unhandledRejection', (err) => {
      console.error('❌ Unhandled Rejection:', err.message);
      console.error(err.stack);
      server.close(() => process.exit(1));
      setTimeout(() => process.exit(1), 10000);
    });

    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught Exception:', err.message);
      console.error(err.stack);
      server.close(() => process.exit(1));
      setTimeout(() => process.exit(1), 10000);
    });

    process.on('SIGTERM', () => {
      console.log('👋 SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    });

    process.on('SIGINT', () => {
      console.log('👋 SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 30000);
    });

    return server;

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};



startServer();