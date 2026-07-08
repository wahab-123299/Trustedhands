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
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refresh);

// Email verification
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authenticate, authController.resendVerification);

// Password reset
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ==========================================
// GOOGLE OAUTH
// ==========================================

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/failure' }),
  authController.oauthCallback
);

// ==========================================
// FACEBOOK OAUTH
// ==========================================

router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email', 'public_profile'],
  session: false
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/api/auth/failure' }),
  authController.oauthCallback
);

// ==========================================
// OAUTH HANDLERS
// ==========================================

router.get('/success', authController.oauthSuccess);
router.get('/failure', authController.oauthFailure);

module.exports = router;