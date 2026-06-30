const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate: protect } = require('../middleware/authMiddleware');

// ==========================================
// AUTH ROUTES — All mounted at /api/auth
// ==========================================

// Registration & Login
router.post('/register', authController.register);
router.post('/login', authController.login);

// Token Management
router.post('/refresh', authController.refresh);
router.post('/logout', protect, authController.logout);

// Current User
router.get('/me', protect, authController.getMe);

// Email Verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// Password Reset
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;