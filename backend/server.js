const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// CRITICAL: Register passport strategies before creating app
require('./config/passport');

const app = require('./app');
const connectDB = require('./config/database');
const chatSocket = require('./socket/chatSocket');
const notificationSocket = require('./socket/notificationSocket');
const mongoose = require('mongoose');

if (process.env.NODE_ENV !== 'production') {
  console.log('MongoDB URI:', process.env.MONGODB_URI);
} else {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const masked = uri.replace(/\/\/(.*?):(.*?)@/, '//****:****@');
    console.log('MongoDB URI:', masked);
  }
}

mongoose.set('strictQuery', false);

const startServer = async () => {
  try {
    await connectDB();
    console.log('Database connection established');

    const server = http.createServer(app);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://trustedhand-app.netlify.app',
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

    // ✅ SINGLE io attachment
    app.set('io', io);

    // ✅ Initialize socket handlers
    chatSocket(io);
    notificationSocket(io);

    // ✅ Register notification routes AFTER io is created
    const notificationRoutes = require('./routes/notificationRoutes');
    app.use('/api/notifications', notificationRoutes);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    let exiting = false;
    const safeExit = (code) => {
      if (!exiting) {
        exiting = true;
        process.exit(code);
      }
    };

    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err.message);
      console.error(err.stack);
      server.close(() => safeExit(1));
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err.message);
      console.error(err.stack);
      server.close(() => safeExit(1));
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        safeExit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        safeExit(0);
      });

    });
    


  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};



startServer();