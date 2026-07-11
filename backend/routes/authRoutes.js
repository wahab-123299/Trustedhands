const express = require('express');
const router = express.Router();

// Local auth controllers
const {
  register,
  login,
  getMe,
  logout,
  refresh,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// OAuth controllers - use the SEPARATE oauthController file
const {
  googleAuth,
  googleCallback,
  facebookAuth,
  facebookCallback
} = require('../controllers/oauthController');

// Middleware
const { authenticate } = require('../middleware/authMiddleware');

// ==========================================
// LOCAL AUTH ROUTES
// ==========================================

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ==========================================
// GOOGLE OAUTH ROUTES
// ==========================================

// Step 1: Redirect to Google
router.get('/google', googleAuth);

// Step 2: Google redirects back here
router.get('/google/callback', ...googleCallback);

// ==========================================
// FACEBOOK OAUTH ROUTES
// ==========================================

// Step 1: Redirect to Facebook
router.get('/facebook', facebookAuth);

// Step 2: Facebook redirects back here
router.get('/facebook/callback', ...facebookCallback);

module.exports = router;