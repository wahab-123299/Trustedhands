const jwt = require('jsonwebtoken');
const { User, Message, Conversation } = require('../models');
const mongoose = require('mongoose');

// In-memory stores (consider Redis for production scaling)
const connectedUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId
const userActivity = new Map(); // userId -> { lastMessageAt, lastTypingAt, messageCount }
const typingUsers = new Map(); // conversationId -> Set of userIds typing

// Rate limiting configuration
const RATE_LIMITS = {
  MESSAGE: { interval: 1000, maxBurst: 5 }, // 1 second between messages, burst of 5
  TYPING: { interval: 2000, maxBurst: 10 }, // 2 seconds between typing events
  JOIN: { interval: 1000, maxBurst: 3 } // 1 second between join attempts
};

module.exports = (io) => {
  // ==========================================
  // AUTHENTICATION MIDDLEWARE
  // ==========================================
  
  io.use(async (socket, next) => {
    try {
      // Extract token from multiple sources
      let token = socket.handshake.auth?.token || 
                  socket.handshake.query?.token ||
                  extractTokenFromCookie(socket.handshake.headers?.cookie);

      if (!token) {
        return next(new Error('AUTH_TOKEN_REQUIRED: Authentication token is required'));
      }

      // Verify JWT
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtError) {
        if (jwtError.name === 'TokenExpiredError') {
          return next(new Error('AUTH_TOKEN_EXPIRED: Your session has expired. Please login again.'));
        }
        if (jwtError.name === 'JsonWebTokenError') {
          return next(new Error('INVALID_TOKEN: Invalid token format'));
        }
        return next(new Error('AUTHENTICATION_FAILED: Token verification failed'));
      }

      // Fetch user with necessary fields
      const user = await User.findById(decoded.userId)
        .select('_id fullName role isActive blacklistedTokens');

      if (!user) {
        return next(new Error('USER_NOT_FOUND: User not found'));
      }

      if (!user.isActive) {
        return next(new Error('ACCOUNT_DEACTIVATED: Your account has been deactivated'));
      }

      // Check if token is blacklisted
      if (user.blacklistedTokens?.some(bt => bt.token === token)) {
        return next(new Error('TOKEN_REVOKED: Token has been revoked. Please login again.'));
      }

      // Attach user data to socket
      socket.userId = user._id.toString();
      socket.user = {
        _id: user._id,
        fullName: user.fullName,
        role: user.role
      };
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('AUTHENTICATION_FAILED: ' + error.message));
    }
  });

  // ==========================================
  // CONNECTION HANDLER
  // ==========================================
  
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const socketId = socket.id;
    
    console.log(`🔌 User connected: ${userId} (${socket.user.fullName}) - Socket: ${socketId}`);

    // Register connection
    connectedUsers.set(userId, socketId);
    socketToUser.set(socketId, userId);
    userActivity.set(userId, {
      lastMessageAt: 0,
      lastTypingAt: 0,
      messageCount: 0,
      joinCount: 0
    });

    // Update user online status in database
    updateUserOnlineStatus(userId, true, socketId);

    // Join personal room for direct notifications
    socket.join(`user_${userId}`);

    // Send connection success with server time
    socket.emit('connected', {
      userId: userId,
      socketId: socketId,
      serverTime: new Date().toISOString(),
      features: ['typing', 'read_receipts', 'attachments', 'reactions']
    });

    // Send unread count on connection
    sendUnreadCount(socket, userId);

    // ==========================================
    // RATE LIMITING HELPER
    // ==========================================
    
    const checkRateLimit = (type) => {
      const now = Date.now();
      const limits = RATE_LIMITS[type];
      const activity = userActivity.get(userId);
      
      if (!activity) return false;
      
      const lastKey = type === 'MESSAGE' ? 'lastMessageAt' : 
                      type === 'TYPING' ? 'lastTypingAt' : 'joinCount';
      
      const lastTime = activity[lastKey] || 0;
      const timeDiff = now - lastTime;
      
      // Check burst limit
      if (type === 'MESSAGE' && activity.messageCount >= limits.maxBurst) {
        if (timeDiff < limits.interval * limits.maxBurst) {
          return false;
        }
        activity.messageCount = 0;
      }
      
      // Check interval
      if (timeDiff < limits.interval) {
        return false;
      }
      
      // Update activity
      activity[lastKey] = now;
      if (type === 'MESSAGE') activity.messageCount++;
      userActivity.set(userId, activity);
      
      return true;
    };

    // ==========================================
    // JOIN CONVERSATION
    // ==========================================
    
    socket.on('join_conversation', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) {
          return socket.emit('error', { 
            code: 'MISSING_CONVERSATION_ID',
            message: 'Conversation ID is required' 
          });
        }

        // Rate limiting
        if (!checkRateLimit('JOIN')) {
          return socket.emit('error', { 
            code: 'RATE_LIMITED',
            message: 'Too many join attempts. Please slow down.' 
          });
        }

        // Verify user is part of conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
          isActive: true
        });

        if (!conversation) {
          return socket.emit('error', { 
            code: 'NOT_AUTHORIZED',
            message: 'You are not part of this conversation or it has been archived' 
          });
        }

        // Join conversation room
        socket.join(`conversation_${conversationId}`);
        
        // Notify other participants
        socket.to(`conversation_${conversationId}`).emit('user_joined', {
          userId: userId,
          userName: socket.user.fullName,
          conversationId,
          timestamp: new Date()
        });

        // Mark messages as read when joining
        const unreadCount = await markConversationAsRead(conversationId, userId);
        
        if (unreadCount > 0) {
          // Notify sender(s) that messages were read
          const otherParticipants = conversation.participants.filter(
            p => p.toString() !== userId
          );
          
          otherParticipants.forEach(participantId => {
            const participantSocketId = connectedUsers.get(participantId.toString());
            if (participantSocketId) {
              io.to(participantSocketId).emit('messages_read', {
                conversationId,
                readBy: userId,
                readAt: new Date(),
                count: unreadCount
              });
            }
          });
        }

        // Send conversation history (last 50 messages)
        const messages = await Message.getConversationMessages(conversationId, {
          limit: 50,
          includeDeleted: false
        });

        socket.emit('conversation_joined', {
          conversationId,
          messages: messages.reverse(), // Oldest first
          unreadCount,
          participants: conversation.participants
        });

        console.log(`✅ User ${userId} joined conversation ${conversationId}`);
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { 
          code: 'JOIN_FAILED',
          message: 'Failed to join conversation',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // ==========================================
    // LEAVE CONVERSATION
    // ==========================================
    
    socket.on('leave_conversation', (data) => {
      const { conversationId } = data || {};
      
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
        socket.to(`conversation_${conversationId}`).emit('user_left', {
          userId: userId,
          userName: socket.user.fullName,
          conversationId,
          timestamp: new Date()
        });
        
        // Clear typing status
        clearTypingStatus(conversationId, userId);
        
        socket.emit('conversation_left', { conversationId });
        console.log(`👋 User ${userId} left conversation ${conversationId}`);
      }
    });

    // ==========================================
    // SEND MESSAGE
    // ==========================================
    
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, attachments, replyTo, clientMessageId } = data;

        // Rate limiting
        if (!checkRateLimit('MESSAGE')) {
          return socket.emit('error', { 
            code: 'RATE_LIMITED',
            message: 'Please wait before sending another message',
            retryAfter: RATE_LIMITS.MESSAGE.interval / 1000
          });
        }

        // Validation
        if (!conversationId) {
          return socket.emit('error', { 
            code: 'MISSING_CONVERSATION_ID',
            message: 'Conversation ID is required' 
          });
        }

        const trimmedContent = content?.trim() || '';
        const hasContent = trimmedContent.length > 0;
        const hasAttachments = attachments && attachments.length > 0;

        if (!hasContent && !hasAttachments) {
          return socket.emit('error', { 
            code: 'EMPTY_MESSAGE',
            message: 'Message cannot be empty' 
          });
        }

        if (trimmedContent.length > 2000) {
          return socket.emit('error', { 
            code: 'MESSAGE_TOO_LONG',
            message: 'Message is too long (max 2000 characters)' 
          });
        }

        // Verify user is in conversation
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: userId,
          isActive: true
        });

        if (!conversation) {
          return socket.emit('error', { 
            code: 'NOT_AUTHORIZED',
            message: 'You are not authorized for this conversation' 
          });
        }

        // Get receiver ID (the other participant)
        const receiverId = conversation.participants.find(
          p => p.toString() !== userId
        );

        if (!receiverId) {
          return socket.emit('error', { 
            code: 'NO_RECEIVER',
            message: 'Could not determine message receiver' 
          });
        }

        // Build message data
        const messageData = {
          conversationId,
          senderId: userId,
          receiverId,
          content: trimmedContent,
          attachments: attachments || [],
          isRead: false,
          deliveryStatus: 'sent'
        };

        // Add reply reference if provided
        if (replyTo) {
          const replyMessage = await Message.findById(replyTo).select('content senderId');
          if (replyMessage) {
            const replySender = await User.findById(replyMessage.senderId).select('fullName');
            messageData.replyTo = {
              messageId: replyTo,
              preview: replyMessage.content?.substring(0, 100) || '[Attachment]',
              senderName: replySender?.fullName || 'Unknown'
            };
          }
        }

        // Create message
        const message = await Message.create(messageData);

        // Populate for broadcast
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'fullName profileImage role isOnline')
          .populate('receiverId', 'fullName profileImage')
          .lean();

        // Update conversation
        await conversation.updateLastMessage(
          trimmedContent || '[Attachment]',
          userId,
          hasAttachments ? attachments[0].type : 'text'
        );

        // Increment unread for receiver
        await conversation.incrementUnread(receiverId);

        // Broadcast to conversation room (excluding sender)
        const broadcastData = {
          message: populatedMessage,
          conversationId,
          clientMessageId // Echo back for client deduplication
        };
        
        socket.to(`conversation_${conversationId}`).emit('receive_message', broadcastData);

        // Send delivery confirmation to sender
        socket.emit('message_sent', {
          success: true,
          message: populatedMessage,
          conversationId,
          clientMessageId,
          status: 'sent',
          timestamp: new Date()
        });

        // Try to mark as delivered if receiver is online
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
          // Mark as delivered
          await message.markAsDelivered();
          
          // Notify sender of delivery
          socket.emit('message_status', {
            messageId: message._id,
            conversationId,
            status: 'delivered',
            deliveredAt: message.deliveredAt
          });

          // Update broadcast with delivered status
          broadcastData.message.deliveryStatus = 'delivered';
          io.to(`conversation_${conversationId}`).emit('message_updated', {
            messageId: message._id,
            updates: { deliveryStatus: 'delivered' }
          });
        }

        // Send push notification data to receiver
        if (receiverSocketId) {
          const unreadCount = await Message.getUnreadCount(receiverId);
          
          io.to(receiverSocketId).emit('notification', {
            type: 'new_message',
            conversationId,
            senderId: userId,
            senderName: socket.user.fullName,
            preview: trimmedContent?.substring(0, 50) || '[Attachment]',
            unreadCount,
            timestamp: new Date()
          });
        }

        console.log(`💬 Message ${message._id} sent from ${userId} to ${receiverId}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { 
          code: 'SEND_FAILED',
          message: 'Failed to send message. Please try again.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    });

    // ==========================================
    // TYPING INDICATOR
    // ==========================================
    
    socket.on('typing', async (data) => {
      try {
        const { conversationId, isTyping } = data;
        
        if (!conversationId) return;

        // Rate limiting
        if (isTyping && !checkRateLimit('TYPING')) {
          return; // Silently drop excessive typing events
        }

        // Verify user is in conversation
        const isInRoom = socket.rooms.has(`conversation_${conversationId}`);
        if (!isInRoom) {
          // Try to verify and join if not in room
          const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: userId,
            isActive: true
          });
          
          if (!conversation) return;
          
          socket.join(`conversation_${conversationId}`);
        }

        // Track typing status
        const typingKey = `conversation_${conversationId}`;
        if (!typingUsers.has(typingKey)) {
          typingUsers.set(typingKey, new Set());
        }
        
        const typingSet = typingUsers.get(typingKey);
        
        if (isTyping) {
          typingSet.add(userId);
        } else {
          typingSet.delete(userId);
        }

        // Broadcast to room (excluding sender)
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: userId,
          userName: socket.user.fullName,
          isTyping,
          conversationId,
          timestamp: new Date()
        });

        // Auto-clear typing after 5 seconds of inactivity
        if (isTyping) {
          setTimeout(() => {
            const currentTyping = typingUsers.get(typingKey);
            if (currentTyping?.has(userId)) {
              currentTyping.delete(userId);
              socket.to(`conversation_${conversationId}`).emit('user_typing', {
                userId: userId,
                userName: socket.user.fullName,
                isTyping: false,
                conversationId,
                timestamp: new Date()
              });
            }
          }, 5000);
        }
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });

    // ==========================================
    // MESSAGE READ RECEIPT
    // ==========================================
    
    socket.on('message_read', async (data) => {
      try {
        const { messageId, conversationId } = data;

        if (!messageId || !conversationId) {
          return socket.emit('error', { 
            code: 'MISSING_DATA',
            message: 'Message ID and Conversation ID are required' 
          });
        }

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit('error', { 
            code: 'MESSAGE_NOT_FOUND',
            message: 'Message not found' 
          });
        }

        // Verify receiver
        if (message.receiverId.toString() !== userId) {
          return socket.emit('error', { 
            code: 'NOT_RECEIVER',
            message: 'Only the recipient can mark as read' 
          });
        }

        // Skip if already read
        if (message.isRead) {
          return socket.emit('message_marked_read', { 
            messageId, 
            wasAlreadyRead: true 
          });
        }

        // Mark as read
        await message.markAsRead();

        // Update conversation unread count
        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
          await conversation.resetUnread(userId);
        }

        // Notify sender
        const senderSocketId = connectedUsers.get(message.senderId.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit('message_status', {
            messageId,
            conversationId,
            status: 'read',
            readAt: message.readAt
          });
        }

        socket.emit('message_marked_read', { 
          messageId, 
          readAt: message.readAt 
        });
      } catch (error) {
        console.error('Message read error:', error);
        socket.emit('error', { 
          code: 'MARK_READ_FAILED',
          message: 'Failed to mark message as read' 
        });
      }
    });

    // ==========================================
    // MARK CONVERSATION AS READ
    // ==========================================
    
    socket.on('mark_conversation_read', async (data) => {
      try {
        const { conversationId } = data;
        
        if (!conversationId) return;

        const count = await Message.markConversationAsRead(conversationId, userId);
        
        if (count > 0) {
          // Notify other participants
          const conversation = await Conversation.findById(conversationId)
            .select('participants');
          
          if (conversation) {
            const otherParticipants = conversation.participants.filter(
              p => p.toString() !== userId
            );
            
            otherParticipants.forEach(participantId => {
              const participantSocketId = connectedUsers.get(participantId.toString());
              if (participantSocketId) {
                io.to(participantSocketId).emit('conversation_read', {
                  conversationId,
                  readBy: userId,
                  readAt: new Date(),
                  count
                });
              }
            });
          }
        }

        socket.emit('conversation_marked_read', { 
          conversationId, 
          markedCount: count 
        });
      } catch (error) {
        console.error('Mark conversation read error:', error);
      }
    });

    // ==========================================
    // GET ONLINE STATUS
    // ==========================================
    
    socket.on('get_online_status', async (data, callback) => {
      try {
        const { userId: targetUserId } = data || {};
        
        if (!targetUserId) {
          return callback?.({ error: 'User ID is required' });
        }

        const isOnline = connectedUsers.has(targetUserId);
        let lastSeen = null;

        if (!isOnline) {
          const user = await User.findById(targetUserId).select('lastLogin');
          lastSeen = user?.lastLogin;
        }

        const response = { 
          userId: targetUserId, 
          isOnline, 
          lastSeen,
          timestamp: new Date()
        };

        if (typeof callback === 'function') {
          callback(response);
        } else {
          socket.emit('online_status', response);
        }
      } catch (error) {
        console.error('Get online status error:', error);
        callback?.({ error: 'Failed to get status' });
      }
    });

    // ==========================================
    // DISCONNECT HANDLER
    // ==========================================
    
    socket.on('disconnect', async (reason) => {
      console.log(`❌ User disconnected: ${userId} (${reason})`);
      
      // Clean up
      connectedUsers.delete(userId);
      socketToUser.delete(socketId);
      userActivity.delete(userId);
      
      // Clear typing status in all conversations
      clearAllTypingStatus(userId);

      // Update database
      await updateUserOnlineStatus(userId, false, null);

      // Notify all conversations that user is offline
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('conversation_')) {
          const conversationId = room.replace('conversation_', '');
          socket.to(room).emit('user_offline', { 
            userId: userId,
            userName: socket.user.fullName,
            lastSeen: new Date(),
            conversationId
          });
        }
      });
    });

    // ==========================================
    // ERROR HANDLING
    // ==========================================
    
    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================
  
  function extractTokenFromCookie(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/accessToken=([^;]+)/);
    return match ? match[1] : null;
  }

  async function updateUserOnlineStatus(userId, isOnline, socketId) {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline,
        socketId,
        ...(isOnline ? {} : { lastLogin: new Date() })
      });
    } catch (error) {
      console.error('Failed to update user online status:', error);
    }
  }

  async function sendUnreadCount(socket, userId) {
    try {
      const unreadCount = await Message.getUnreadCount(userId);
      const conversationUnread = await Conversation.aggregate([
        {
          $match: {
            participants: new mongoose.Types.ObjectId(userId),
            isActive: true
          }
        },
        {
          $project: {
            _id: 1,
            unread: {
              $ifNull: [
                { $toInt: { $getField: { field: { $literal: userId }, input: "$unreadCount" } } },
                0
              ]
            }
          }
        }
      ]);

      socket.emit('unread_count', {
        total: unreadCount,
        conversations: conversationUnread.reduce((acc, c) => {
          acc[c._id.toString()] = c.unread;
          return acc;
        }, {})
      });
    } catch (error) {
      console.error('Failed to send unread count:', error);
    }
  }

  async function markConversationAsRead(conversationId, userId) {
    try {
      const count = await Message.markConversationAsRead(conversationId, userId);
      
      // Reset conversation unread count
      await Conversation.findByIdAndUpdate(conversationId, {
        $set: { [`unreadCount.${userId}`]: 0 }
      });
      
      return count;
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
      return 0;
    }
  }

  function clearTypingStatus(conversationId, userId) {
    const typingKey = `conversation_${conversationId}`;
    const typingSet = typingUsers.get(typingKey);
    if (typingSet) {
      typingSet.delete(userId);
      if (typingSet.size === 0) {
        typingUsers.delete(typingKey);
      }
    }
  }

  function clearAllTypingStatus(userId) {
    typingUsers.forEach((typingSet, key) => {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        // Notify room that user stopped typing
        const conversationId = key.replace('conversation_', '');
        io.to(key).emit('user_typing', {
          userId,
          isTyping: false,
          conversationId,
          timestamp: new Date()
        });
      }
    });
  }

  // ==========================================
  // IO HELPER METHODS (for use in controllers)
  // ==========================================
  
  io.sendNotification = (userId, data) => {
    const socketId = connectedUsers.get(userId.toString());
    if (socketId) {
      io.to(`user_${userId}`).emit('notification', {
        ...data,
        timestamp: new Date()
      });
      return true;
    }
    return false;
  };

  io.sendToConversation = (conversationId, event, data) => {
    io.to(`conversation_${conversationId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  };

  io.getOnlineUsers = () => {
    return Array.from(connectedUsers.keys());
  };

  io.isUserOnline = (userId) => {
    return connectedUsers.has(userId.toString());
  };

  io.getSocketId = (userId) => {
    return connectedUsers.get(userId.toString());
  };
};