const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// ==========================================
// LOCAL AUTH
// ==========================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);

// ==========================================
// EMAIL VERIFICATION
// ==========================================
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);

// ==========================================
// PASSWORD RESET
// ==========================================
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ==========================================
// GOOGLE OAUTH
// ==========================================
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/oauth-failure',
    session: false 
  }),
  authController.oauthCallback
);

// ==========================================
// FACEBOOK OAUTH
// ==========================================
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { 
    failureRedirect: '/api/auth/oauth-failure',
    session: false 
  }),
  authController.oauthCallback
);

// ==========================================
// OAUTH STATUS ENDPOINTS
// ==========================================
router.get('/oauth-success', authController.oauthSuccess);
router.get('/oauth-failure', authController.oauthFailure);

module.exports = router;