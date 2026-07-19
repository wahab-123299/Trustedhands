const jwt = require('jsonwebtoken');
const { Conversation, Message } = require('../models');

/**
 * Initialize chat socket handlers
 * FIXED: Uses Socket.IO namespace to avoid duplicate connection handlers
 * @param {Server} io - Socket.io server instance
 */
const chatSocket = (io) => {
  // Use a namespace for chat to avoid conflicts with base socket.js connection handler
  const chatNamespace = io.of('/chat');

  // Middleware to authenticate socket connections
  chatNamespace.use(async (socket, next) => {
    try {
      // Check for token in auth object (from frontend) or cookies
      const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie?.match(/accessToken=([^;]+)/)?.[1];

      if (!token) {
        return next(new Error('AUTH_TOKEN_REQUIRED: Authentication token is required'));
      }

      // FIXED: Use same JWT verification as HTTP middleware (with issuer/audience)
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'trustedhand-api',
        audience: 'trustedhand-client',
      });

      // Attach user data to socket
      socket.userId = decoded.userId || decoded.id;
      socket.token = token;

      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket Auth] User authenticated:', socket.userId);
      }
      next();
    } catch (error) {
      console.error('[Socket Auth] Failed:', error.message);
      next(new Error('AUTH_TOKEN_REQUIRED: ' + error.message));
    }
  });

  chatNamespace.on('connection', (socket) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Socket] User connected: ${socket.userId}, Socket ID: ${socket.id}`);
    }

    // Join personal room for direct messages
    socket.on('join_personal', ({ userId }) => {
      if (userId === socket.userId) {
        socket.join(`user_${userId}`);
        console.log(`[Socket] User ${userId} joined personal room`);

        // Notify friends that user is online
        socket.broadcast.emit('user_online', { userId });
      }
    });

    // Join conversation room
    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        // Verify user is part of this conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Conversation not found' });
          return;
        }

        socket.join(`conversation_${conversationId}`);

        if (process.env.NODE_ENV === 'development') {
          console.log(`[Socket] User ${socket.userId} joined conversation ${conversationId}`);
        }

        // Load recent messages
        const messages = await Message.find({ conversationId })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('senderId', 'fullName profileImage')
          .lean();

        socket.emit('conversation_joined', {
          conversationId,
          messages: messages.reverse()
        });

        // Notify other participants
        socket.to(`conversation_${conversationId}`).emit('user_joined', {
          userId: socket.userId,
          conversationId
        });
      } catch (error) {
        console.error('[Socket] Join conversation error:', error);
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to join conversation' });
      }
    });

    // Leave conversation
    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation_${conversationId}`);
      console.log(`[Socket] User ${socket.userId} left conversation ${conversationId}`);
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, receiverId, content, attachments, replyTo, clientMessageId } = data;

        // Verify user is in conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Conversation not found' });
          return;
        }

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          receiverId,
          content,
          attachments: attachments || [],
          replyTo,
          clientMessageId,
          deliveryStatus: 'sent'
        });

        // Populate sender info
        await message.populate('senderId', 'fullName profileImage');

        // Update conversation
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // Broadcast to conversation room
        const messageData = {
          message: message.toObject(),
          conversationId,
          clientMessageId
        };

        chatNamespace.to(`conversation_${conversationId}`).emit('receive_message', messageData);

        // Confirm to sender
        socket.emit('message_sent', messageData);

        // Send notification to receiver if offline
        const receiverSocketId = getUserSocketId(receiverId);
        if (!receiverSocketId) {
          io.to(`user_${receiverId}`).emit('notification', {
            type: 'new_message',
            message: `New message from ${message.senderId.fullName}`,
            conversationId
          });
        }

        // Update unread count for receiver
        updateUnreadCount(conversationId, receiverId);

      } catch (error) {
        console.error('[Socket] Send message error:', error);
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName || 'Someone',
        isTyping,
        conversationId
      });
    });

    // Mark message as read
    socket.on('message_read', async ({ messageId, conversationId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          isRead: true,
          readAt: new Date(),
          deliveryStatus: 'read'
        });

        // Notify sender
        socket.to(`conversation_${conversationId}`).emit('message_status', {
          messageId,
          conversationId,
          status: 'read',
          readAt: new Date()
        });
      } catch (error) {
        console.error('[Socket] Mark read error:', error);
      }
    });

    // Mark conversation as read
    socket.on('mark_conversation_read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversationId, receiverId: socket.userId, isRead: false },
          { isRead: true, readAt: new Date(), deliveryStatus: 'read' }
        );

        socket.to(`conversation_${conversationId}`).emit('messages_read', {
          conversationId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error('[Socket] Mark conversation read error:', error);
      }
    });

    // Get online status
    socket.on('get_online_status', ({ userId }, callback) => {
      const isOnline = chatNamespace.adapter.rooms.has(`user_${userId}`);
      callback({ isOnline });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Socket] User disconnected: ${socket.userId}, Reason: ${reason}`);
      }

      // Notify that user is offline
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        lastSeen: new Date()
      });
    });
  });

  // Helper functions
  function getUserSocketId(userId) {
    const room = chatNamespace.adapter.rooms.get(`user_${userId}`);
    return room ? Array.from(room)[0] : null;
  }

  async function updateUnreadCount(conversationId, userId) {
    const count = await Message.countDocuments({
      conversationId,
      receiverId: userId,
      isRead: false
    });

    chatNamespace.to(`user_${userId}`).emit('unread_count', {
      count,
      conversations: { [conversationId]: count }
    });
  }
};

module.exports = chatSocket;