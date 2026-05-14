const { Server } = require('socket.io');

let io = null;

module.exports = {
  init: (httpServer) => {
    io = new Server(httpServer, {
      cors: {
        origin: [
          'http://localhost:5173',
          'http://localhost:3000',
          'https://trustedhand-app.netlify.app',
          'https://trustedhands.onrender.com',
          process.env.FRONTEND_URL
        ].filter(Boolean),
        credentials: true,
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      socket.on('join', (userId) => {
        if (userId) {
          socket.join(`user_${userId}`);
          console.log(`[Socket] User ${userId} joined room`);
        }
      });

      socket.on('leave', (userId) => {
        if (userId) {
          socket.leave(`user_${userId}`);
        }
      });

      socket.on('join_conversation', (conversationId) => {
        if (conversationId) {
          socket.join(`conversation_${conversationId}`);
        }
      });

      socket.on('leave_conversation', (conversationId) => {
        if (conversationId) {
          socket.leave(`conversation_${conversationId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized! Call init() first in server.js');
    }
    return io;
  }
};