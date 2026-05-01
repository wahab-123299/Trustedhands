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

// TEMPORARY: Debug endpoints - REMOVE AFTER FIXING
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

// TEMPORARY: List all users with password info - REMOVE AFTER FIXING
router.get('/debug-users', async (req, res) => {
  try {
    const users = await require('../models').User.find({}).select('+password');
    res.json({
      count: users.length,
      users: users.map(u => ({
        id: u._id,
        email: u.email,
        role: u.role,
        hasPassword: !!u.password,
        passwordType: typeof u.password,
        passwordPrefix: u.password ? u.password.substring(0, 15) + '...' : null,
        isActive: u.isActive,
        createdAt: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TEMPORARY: Admin password reset - REMOVE AFTER FIXING
router.post('/admin-reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const user = await require('../models').User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true, 
      message: `Password reset for ${email}`,
      note: 'Password is now properly hashed with bcrypt'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);

module.exports = router;