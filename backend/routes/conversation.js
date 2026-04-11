const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

// GET /api/conversations - Get all conversations for user
router.get('/', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.id,
      isActive: true
    })
    .populate('participants', 'fullName email avatar role isOnline')
    .populate('jobId', 'title status')
    .sort({ 'lastMessage.createdAt': -1 });

    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching conversations'
    });
  }
});

// GET /api/conversations/:id - Get single conversation
router.get('/:id', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'fullName email avatar role')
      .populate('jobId', 'title status');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const messages = await Message.find({ conversation: req.params.id })
      .populate('sender', 'fullName avatar')
      .sort({ createdAt: 1 });

    // Reset unread count
    await conversation.resetUnread(req.user.id);

    res.json({
      success: true,
      data: { conversation, messages }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/conversations - Create new conversation
router.post('/', protect, async (req, res) => {
  try {
    const { participantId, jobId, initialMessage } = req.body;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        error: 'Participant ID is required'
      });
    }

    // Use your model's findOrCreate method
    const conversation = await Conversation.findOrCreate(
      [req.user.id, participantId],
      jobId,
      req.user.id
    );

    if (initialMessage && initialMessage.trim()) {
      await Message.create({
        conversation: conversation._id,
        sender: req.user.id,
        content: initialMessage.trim()
      });
      await conversation.updateLastMessage(initialMessage.trim(), req.user.id);
    }

    await conversation.populate('participants', 'fullName email avatar role');
    await conversation.populate('jobId', 'title status');

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Server error'
    });
  }
});

// POST /api/conversations/:id/messages - Send message
router.post('/:id/messages', protect, async (req, res) => {
  try {
    const { content } = req.body;
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    if (!conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    const message = await Message.create({
      conversation: req.params.id,
      sender: req.user.id,
      content: content.trim()
    });

    // Update last message
    await conversation.updateLastMessage(content.trim(), req.user.id);

    // Increment unread for other participants
    for (const participant of conversation.participants) {
      if (participant.toString() !== req.user.id) {
        await conversation.incrementUnread(participant);
      }
    }

    await message.populate('sender', 'fullName avatar');

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PUT /api/conversations/:id/read - Mark as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation || !conversation.isParticipant(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
    }

    await conversation.resetUnread(req.user.id);

    await Message.updateMany(
      {
        conversation: req.params.id,
        sender: { $ne: req.user.id },
        read: false
      },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Error marking as read:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;