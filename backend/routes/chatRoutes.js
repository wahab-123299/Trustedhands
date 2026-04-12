const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/authMiddleware');

// Protected routes
router.get('/conversations', authenticate, chatController.getConversations);
router.post('/conversations', authenticate, chatController.createConversation);
router.get('/conversations/:id/messages', authenticate, chatController.getMessages);
router.post('/conversations/:id/messages', authenticate, chatController.sendMessage);
router.put('/conversations/:id/read', authenticate, chatController.markAsRead);
router.delete('/conversations/:id', authenticate, chatController.deleteConversation);
router.get('/unread-count', authenticate, chatController.getUnreadCount);

module.exports = router;
