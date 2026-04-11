const { Conversation, Message, User, Job } = require('../models');
const { AppError } = require('../utils/errorHandler');

// Get all conversations for current user
exports.getConversations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId
    })
      .populate('participants', 'fullName profileImage role isOnline socketId')
      .populate('jobId', 'title status')
      .sort({ updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Add unread count for current user
    const conversationsWithUnread = conversations.map(conv => {
      const convObj = conv.toObject();
      const unreadCount = conv.unreadCount.get(userId.toString()) || 0;
      convObj.unreadCount = unreadCount;
      return convObj;
    });

    const total = await Conversation.countDocuments({ participants: userId });

    res.json({
      success: true,
      data: {
        conversations: conversationsWithUnread,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get messages for a conversation
exports.getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You do not have access to this conversation.');
    }

    const messages = await Message.find({
      conversationId: id,
      isDeleted: false
    })
      .populate('senderId', 'fullName profileImage')
      .populate('receiverId', 'fullName profileImage')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Mark messages as read
    await Message.updateMany(
      {
        conversationId: id,
        receiverId: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Reset unread count for this user
    await conversation.resetUnread(userId);

    const total = await Message.countDocuments({
      conversationId: id,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create or get existing conversation
exports.createConversation = async (req, res, next) => {
  try {
    const { participantId, jobId } = req.body;
    const userId = req.user._id;

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      throw new AppError('USER_NOT_FOUND', 'User not found.');
    }

    // Check if there's an existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, participantId] }
    })
      .populate('participants', 'fullName profileImage role isOnline socketId')
      .populate('jobId', 'title status');

    if (conversation) {
      // Update jobId if provided
      if (jobId && !conversation.jobId) {
        conversation.jobId = jobId;
        await conversation.save();
      }

      return res.json({
        success: true,
        data: { conversation }
      });
    }

    // Check if users have an active job together (optional restriction)
    if (jobId) {
      const job = await Job.findById(jobId);
      if (!job) {
        throw new AppError('JOB_NOT_FOUND', 'Job not found.');
      }

      const isInvolved = job.customerId.toString() === userId.toString() ||
                        job.artisanId.toString() === userId.toString();
      
      if (!isInvolved) {
        throw new AppError('AUTH_UNAUTHORIZED', 'You are not involved in this job.');
      }
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [userId, participantId],
      jobId: jobId || null
    });

    await conversation.populate('participants', 'fullName profileImage role isOnline socketId');
    await conversation.populate('jobId', 'title status');

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: { conversation }
    });
  } catch (error) {
    next(error);
  }
};

// Send message
exports.sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user._id;

    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You do not have access to this conversation.');
    }

    // Get receiver ID (the other participant)
    const receiverId = conversation.participants.find(
      p => p.toString() !== userId.toString()
    );

    // Create message
    const message = await Message.create({
      conversationId: id,
      senderId: userId,
      receiverId,
      content,
      attachments: attachments || []
    });

    // Update conversation last message
    await conversation.updateLastMessage(content, userId);

    // Increment unread count for receiver
    await conversation.incrementUnread(receiverId);

    // Populate message
    await message.populate('senderId', 'fullName profileImage');
    await message.populate('receiverId', 'fullName profileImage');

    // Emit to receiver via socket (if online)
    const io = req.app.get('io');
    const receiver = await User.findById(receiverId);
    
    if (receiver && receiver.socketId) {
      io.to(receiver.socketId).emit('receive_message', {
        message,
        conversationId: id
      });

      // Update unread count
      const unreadCount = await Message.getUnreadCount(receiverId);
      io.to(receiver.socketId).emit('unread_count', { count: unreadCount });
    }

    res.status(201).json({
      success: true,
      data: { message }
    });
  } catch (error) {
    next(error);
  }
};

// Delete conversation
exports.deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You do not have access to this conversation.');
    }

    // Soft delete - mark as inactive
    conversation.isActive = false;
    await conversation.save();

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const count = await Message.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    next(error);
  }
};

// Mark messages as read
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId
    });

    if (!conversation) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You do not have access to this conversation.');
    }

    // Mark all messages as read
    await Message.updateMany(
      {
        conversationId: id,
        receiverId: userId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    // Reset unread count
    await conversation.resetUnread(userId);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    next(error);
  }
};
