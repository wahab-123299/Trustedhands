const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');
const { authenticate } = require('../middleware/authMiddleware');

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
  facebookCallback,
  exchangeOAuthState  // NEW: state exchange endpoint
} = require('../controllers/oauthController');



// ==========================================
// LOCAL AUTH ROUTES
// ==========================================

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ==========================================
// OAUTH STATE EXCHANGE (NEW)
// Frontend calls this after OAuth redirect to get user info
// ==========================================
router.get('/oauth-exchange', exchangeOAuthState);

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

router.get('/oauth/exchange', oauthController.exchangeOAuthState);

module.exports = router;