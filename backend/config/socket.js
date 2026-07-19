const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        const allowedOrigins = [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://trustedhand.org',
          'https://www.trustedhand.org',
          'https://trustedhand-app.netlify.app',
          'https://trustedhands.onrender.com',
          process.env.FRONTEND_URL,
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin) || origin.includes('netlify.app')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
  });

  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // FIXED: Use same verification as HTTP middleware (with issuer/audience)
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'trustedhand-api',
        audience: 'trustedhand-client',
      });

      socket.userId = decoded.userId || decoded.id;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.userId}`);

    // Join user-specific room for targeted notifications
    socket.join(`user_${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.userId}`);
    });
  });

  // Load chat-specific handlers
  require('../socket/chatSocket')(io);

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };