const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// TEMPORARY: Database health check - REMOVE AFTER FIXING
router.get('/db-status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userCount = await require('../models').User.countDocuments();
    
    res.json({
      connected: mongoose.connection.readyState === 1,
      databaseName: mongoose.connection.name,
      userCount: userCount,
      message: userCount === 0 ? 'WARNING: No users found!' : `Found ${userCount} users`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;
