const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

// Get all notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await notificationService.getAll(req.user._id, parseInt(page), parseInt(limit));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unread notifications
router.get('/unread', auth, async (req, res) => {
  try {
    const notifications = await notificationService.getUnread(req.user._id);
    const count = await notificationService.getUnreadCount(req.user._id);
    
    res.json({
      success: true,
      data: { notifications, count }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }
    
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark all as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;