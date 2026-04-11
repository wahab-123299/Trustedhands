const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'file', 'voice', 'video', 'document', 'location', 'contact'],
    required: [true, 'Attachment type is required']
  },
  url: {
    type: String,
    required: [true, 'Attachment URL is required'],
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v) || v.startsWith('data:');
      },
      message: 'Invalid URL format'
    }
  },
  name: {
    type: String,
    trim: true,
    maxlength: [255, 'Filename too long']
  },
  size: {
    type: Number,
    min: [0, 'Size cannot be negative'],
    max: [50 * 1024 * 1024, 'File too large (max 50MB)'] // 50MB limit
  },
  mimeType: {
    type: String,
    trim: true
  },
  // ADDED: Image/video specific
  dimensions: {
    width: Number,
    height: Number
  },
  duration: Number, // For audio/video in seconds
  thumbnailUrl: String // For videos
}, { _id: true });

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Conversation ID is required'],
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required'],
    index: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required'],
    index: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    validate: {
      validator: function(value) {
        // Content required if no attachments
        if ((!value || value.trim().length === 0) && 
            (!this.attachments || this.attachments.length === 0)) {
          return false;
        }
        return true;
      },
      message: 'Message must have content or attachments'
    }
  },
  attachments: {
    type: [attachmentSchema],
    validate: {
      validator: function(v) {
        return v.length <= 10; // Max 10 attachments per message
      },
      message: 'Maximum 10 attachments allowed'
    }
  },
  // Read receipt tracking
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  
  // Delivery tracking
  deliveryStatus: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
    index: true
  },
  deliveredAt: Date,
  failedAt: Date,
  failureReason: String,
  
  // Soft delete (for "delete for me" / "delete for everyone")
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: Date,
  deletedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: Date.now
    },
    deleteType: {
      type: String,
      enum: ['for_me', 'for_everyone']
    }
  }],
  
  // Reply/Thread support
  replyTo: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    preview: String, // Snippet of original message
    senderName: String
  },
  
  // Reactions (emoji reactions to messages)
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true,
      maxlength: 2 // Single emoji
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Edit history
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  editHistory: [{
    content: String,
    editedAt: Date
  }],
  
  // System message metadata
  metadata: {
    type: {
      type: String,
      enum: ['job_created', 'job_accepted', 'job_completed', 'payment_received', 'payment_released', 'system']
    },
    data: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES (Optimized for query patterns)
// ==========================================

// Primary query: Messages in conversation (paginated)
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Unread messages for user
messageSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });

// Sender's messages
messageSchema.index({ senderId: 1, createdAt: -1 });

// Search messages by content
messageSchema.index({ content: 'text', conversationId: 1 });

// Recent activity
messageSchema.index({ createdAt: -1 });

// ==========================================
// MIDDLEWARE
// ==========================================

// Validation before save
messageSchema.pre('save', function(next) {
  // Ensure sender and receiver are different
  if (this.senderId.toString() === this.receiverId.toString()) {
    return next(new Error('Sender and receiver cannot be the same user'));
  }
  
  // Trim content
  if (this.content) {
    this.content = this.content.trim();
  }
  
  // Validate attachments
  if (this.attachments && this.attachments.length > 0) {
    const validTypes = ['image', 'file', 'voice', 'video', 'document', 'location', 'contact'];
    const invalid = this.attachments.some(a => !validTypes.includes(a.type));
    if (invalid) {
      return next(new Error('Invalid attachment type'));
    }
  }
  
  next();
});

// Post-save: Update conversation last message
messageSchema.post('save', async function(doc) {
  try {
    const Conversation = mongoose.model('Conversation');
    await Conversation.findByIdAndUpdate(
      doc.conversationId,
      {
        lastMessage: {
          content: doc.content?.substring(0, 100) || '[Attachment]',
          senderId: doc.senderId,
          messageType: doc.attachments?.length > 0 ? doc.attachments[0].type : 'text',
          createdAt: doc.createdAt
        },
        updatedAt: new Date()
      }
    );
  } catch (error) {
    console.error('Failed to update conversation last message:', error);
  }
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Mark message as read
 */
messageSchema.methods.markAsRead = async function() {
  if (this.isRead) return this;
  
  this.isRead = true;
  this.readAt = new Date();
  this.deliveryStatus = 'read';
  
  return await this.save();
};

/**
 * Mark message as delivered
 */
messageSchema.methods.markAsDelivered = async function() {
  if (this.deliveryStatus !== 'sent') return this;
  
  this.deliveryStatus = 'delivered';
  this.deliveredAt = new Date();
  
  return await this.save();
};

/**
 * Mark message as failed
 */
messageSchema.methods.markAsFailed = async function(reason) {
  this.deliveryStatus = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  
  return await this.save();
};

/**
 * Soft delete for a user
 */
messageSchema.methods.softDelete = async function(userId, deleteType = 'for_me') {
  const userIdStr = userId.toString();
  
  // Check if already deleted by this user
  const alreadyDeleted = this.deletedBy?.some(d => d.userId.toString() === userIdStr);
  if (alreadyDeleted) return this;
  
  this.deletedBy.push({
    userId,
    deleteType,
    deletedAt: new Date()
  });
  
  // If both participants deleted "for everyone", mark as fully deleted
  const forEveryoneCount = this.deletedBy.filter(d => d.deleteType === 'for_everyone').length;
  if (forEveryoneCount >= 2) {
    this.isDeleted = true;
    this.deletedAt = new Date();
  }
  
  return await this.save();
};

/**
 * Edit message content
 */
messageSchema.methods.edit = async function(newContent, userId) {
  // Only sender can edit
  if (this.senderId.toString() !== userId.toString()) {
    throw new Error('Only the sender can edit this message');
  }
  
  // Can't edit deleted messages
  if (this.isDeleted) {
    throw new Error('Cannot edit deleted messages');
  }
  
  // Save edit history
  if (!this.editHistory) this.editHistory = [];
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent.trim();
  this.isEdited = true;
  this.editedAt = new Date();
  
  return await this.save();
};

/**
 * Add reaction
 */
messageSchema.methods.addReaction = async function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    userId,
    emoji,
    createdAt: new Date()
  });
  
  return await this.save();
};

/**
 * Remove reaction
 */
messageSchema.methods.removeReaction = async function(userId) {
  this.reactions = this.reactions.filter(
    r => r.userId.toString() !== userId.toString()
  );
  
  return await this.save();
};

// ==========================================
// STATIC METHODS
// ==========================================

/**
 * Get unread count for a user
 */
messageSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    receiverId: userId,
    isRead: false,
    isDeleted: false,
    deliveryStatus: { $ne: 'failed' }
  });
};

/**
 * Get unread count by conversation
 */
messageSchema.statics.getUnreadCountByConversation = async function(userId, conversationId) {
  return await this.countDocuments({
    receiverId: userId,
    conversationId,
    isRead: false,
    isDeleted: false
  });
};

/**
 * Get messages in a conversation with pagination
 */
messageSchema.statics.getConversationMessages = async function(conversationId, options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    before,
    after,
    includeDeleted = false 
  } = options;

  const query = { conversationId };
  
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  } else if (after) {
    query.createdAt = { $gt: new Date(after) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  return await this.find(query)
    .populate('senderId', 'fullName profileImage role isOnline')
    .populate('receiverId', 'fullName profileImage')
    .populate('replyTo.messageId', 'content senderId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
};

/**
 * Mark all messages in a conversation as read
 */
messageSchema.statics.markConversationAsRead = async function(conversationId, userId) {
  const result = await this.updateMany(
    {
      conversationId,
      receiverId: userId,
      isRead: false,
      isDeleted: false
    },
    {
      isRead: true,
      readAt: new Date(),
      deliveryStatus: 'read'
    }
  );
  
  return result.modifiedCount || 0;
};

/**
 * Search messages
 */
messageSchema.statics.searchMessages = async function(userId, searchTerm, options = {}) {
  const { page = 1, limit = 20 } = options;

  return await this.find({
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ],
    content: { $regex: searchTerm, $options: 'i' },
    isDeleted: false
  })
    .populate('senderId', 'fullName profileImage')
    .populate('conversationId', 'participants')
    .sort({ createdAt: -1 })
    .skip((parseInt(page) - 1) * parseInt(limit))
    .limit(parseInt(limit));
};

/**
 * Get recent messages for a user across all conversations
 */
messageSchema.statics.getRecentMessages = async function(userId, options = {}) {
  const { limit = 50, since } = options;

  const query = {
    $or: [
      { senderId: userId },
      { receiverId: userId }
    ],
    isDeleted: false
  };

  if (since) {
    query.createdAt = { $gt: new Date(since) };
  }

  return await this.find(query)
    .populate('senderId', 'fullName profileImage')
    .populate('conversationId', 'participants')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));
};

/**
 * Get message statistics for a user
 */
messageSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { senderId: new mongoose.Types.ObjectId(userId) },
          { receiverId: new mongoose.Types.ObjectId(userId) }
        ],
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalSent: {
          $sum: { $cond: [{ $eq: ['$senderId', new mongoose.Types.ObjectId(userId)] }, 1, 0] }
        },
        totalReceived: {
          $sum: { $cond: [{ $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] }, 1, 0] }
        },
        totalUnread: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$receiverId', new mongoose.Types.ObjectId(userId)] },
                  { $eq: ['$isRead', false] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  return stats[0] || { totalSent: 0, totalReceived: 0, totalUnread: 0 };
};

module.exports = mongoose.model('Message', messageSchema);