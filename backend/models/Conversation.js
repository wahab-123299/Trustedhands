const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Participants are required']
  }],
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    index: true
  },
  lastMessage: {
    content: {
      type: String,
      default: '',
      maxlength: [200, 'Last message preview too long']
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // ADDED: Conversation metadata
  metadata: {
    jobStatus: String, // Track job status for context
    lastActivityType: {
      type: String,
      enum: ['message', 'payment', 'job_update', 'system'],
      default: 'message'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES (Optimized for query patterns)
// ==========================================

// Primary query: Get user's conversations sorted by recent activity
conversationSchema.index({ participants: 1, 'lastMessage.createdAt': -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Job-based lookup
conversationSchema.index({ jobId: 1, participants: 1 });

// Active conversations only
conversationSchema.index({ isActive: 1, updatedAt: -1 });

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

// Ensure exactly 2 participants and proper initialization
conversationSchema.pre('save', async function(next) {
  // Skip validation if not new or participants not modified
  if (!this.isNew && !this.isModified('participants')) {
    return next();
  }

  // Validate participant count
  if (!this.participants || this.participants.length !== 2) {
    return next(new Error('Conversation must have exactly 2 participants'));
  }

  // Ensure participants are unique (different users)
  const participantIds = this.participants.map(p => p.toString());
  const uniqueParticipants = [...new Set(participantIds)];
  
  if (uniqueParticipants.length !== 2) {
    return next(new Error('Participants must be two different users'));
  }

  // Validate participants exist (optional but recommended)
  try {
    const User = mongoose.model('User');
    const users = await User.find({ _id: { $in: this.participants } }).select('_id');
    if (users.length !== 2) {
      return next(new Error('One or more participants not found'));
    }
  } catch (error) {
    // Continue even if check fails (will fail on message creation if user doesn't exist)
  }

  // Initialize unread counts for both participants
  if (this.isNew && this.unreadCount.size === 0) {
    this.participants.forEach(p => {
      this.unreadCount.set(p.toString(), 0);
    });
  }

  next();
});

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Find existing conversation or create new one
 * @param {Array} participantIds - Array of 2 user IDs
 * @param {ObjectId} jobId - Optional job ID
 * @param {ObjectId} createdBy - User creating the conversation
 * @returns {Promise<Conversation>}
 */
conversationSchema.statics.findOrCreate = async function(participantIds, jobId = null, createdBy = null) {
  if (!participantIds || participantIds.length !== 2) {
    throw new Error('Exactly 2 participant IDs required');
  }

  // Normalize and sort IDs for consistent lookup
  const sortedIds = [...participantIds]
    .map(id => id.toString())
    .sort();

  // Check for existing conversation
  let conversation = await this.findOne({
    participants: { $all: sortedIds, $size: 2 },
    isActive: true
  });

  // If jobId provided, also check for job-specific conversation
  if (!conversation && jobId) {
    conversation = await this.findOne({
      jobId,
      participants: { $all: sortedIds, $size: 2 }
    });
  }

  // Create new conversation if not found
  if (!conversation) {
    conversation = await this.create({
      participants: sortedIds,
      jobId,
      createdBy,
      lastMessage: {
        content: '',
        createdAt: new Date()
      },
      unreadCount: new Map([
        [sortedIds[0], 0],
        [sortedIds[1], 0]
      ])
    });
  }

  return conversation;
};

/**
 * Get conversations for a user with pagination
 */
conversationSchema.statics.getConversationsForUser = async function(userId, options = {}) {
  const { 
    page = 1, 
    limit = 20,
    includeInactive = false 
  } = options;

  const query = {
    participants: userId
  };

  if (!includeInactive) {
    query.isActive = true;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  return await this.find(query)
    .populate('participants', 'fullName profileImage isOnline role lastLogin')
    .populate('jobId', 'title status budget scheduledDate')
    .populate('lastMessage.senderId', 'fullName')
    .sort({ 'lastMessage.createdAt': -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean(); // Use lean for better performance
};

/**
 * Get total unread message count across all conversations for a user
 */
conversationSchema.statics.getTotalUnreadCount = async function(userId) {
  const result = await this.aggregate([
    {
      $match: {
        participants: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $project: {
        unreadForUser: {
          $ifNull: [
            { $toInt: { $getField: { field: { $literal: userId.toString() }, input: "$unreadCount" } } },
            0
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalUnread: { $sum: "$unreadForUser" }
      }
    }
  ]);

  return result[0]?.totalUnread || 0;
};

/**
 * Get conversation statistics for a user
 */
conversationSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        participants: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        withUnread: {
          $sum: {
            $cond: [
              { $gt: [{ $ifNull: [{ $toInt: { $getField: { field: { $literal: userId.toString() }, input: "$unreadCount" } } }, 0] }, 0] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  return stats[0] || { totalConversations: 0, withUnread: 0 };
};

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Increment unread count for a specific user
 */
conversationSchema.methods.incrementUnread = async function(userId) {
  const userIdStr = userId.toString();
  
  // Don't increment if user is the last message sender
  if (this.lastMessage?.senderId?.toString() === userIdStr) {
    return this;
  }

  const currentCount = this.unreadCount.get(userIdStr) || 0;
  this.unreadCount.set(userIdStr, currentCount + 1);
  this.updatedAt = new Date();
  
  return await this.save();
};

/**
 * Reset unread count for a specific user
 */
conversationSchema.methods.resetUnread = async function(userId) {
  const userIdStr = userId.toString();
  this.unreadCount.set(userIdStr, 0);
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Update last message preview
 */
conversationSchema.methods.updateLastMessage = async function(content, senderId, messageType = 'text') {
  const preview = content?.substring(0, 100) || '[Attachment]';
  
  this.lastMessage = {
    content: preview,
    senderId,
    messageType,
    createdAt: new Date()
  };
  
  this.updatedAt = new Date();
  this['metadata.lastActivityType'] = 'message';
  
  return await this.save();
};

/**
 * Get the other participant in the conversation
 */
conversationSchema.methods.getOtherParticipant = function(userId) {
  const userIdStr = userId.toString();
  const other = this.participants.find(p => {
    const pStr = p._id ? p._id.toString() : p.toString();
    return pStr !== userIdStr;
  });
  return other;
};

/**
 * Check if user is a participant
 */
conversationSchema.methods.isParticipant = function(userId) {
  const userIdStr = userId.toString();
  return this.participants.some(p => {
    const pStr = p._id ? p._id.toString() : p.toString();
    return pStr === userIdStr;
  });
};

/**
 * Archive (soft delete) conversation
 */
conversationSchema.methods.archive = async function() {
  this.isActive = false;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Reactivate archived conversation
 */
conversationSchema.methods.reactivate = async function() {
  this.isActive = true;
  this.updatedAt = new Date();
  return await this.save();
};

// ==========================================
// VIRTUALS
// ==========================================

// Get other participant for a given user (convenience)
conversationSchema.virtual('otherParticipant').get(function() {
  // This requires context (which user is asking), so it's limited
  // Use instance method getOtherParticipant(userId) instead
  return null;
});

module.exports = mongoose.model('Conversation', conversationSchema);