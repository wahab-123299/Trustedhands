const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// ==========================================
// LOCAL AUTH ROUTES
// ==========================================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ==========================================
// GOOGLE OAUTH ROUTES
// ==========================================
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  authController.oauthCallback
);

// ==========================================
// FACEBOOK OAUTH ROUTES
// ==========================================
router.get('/facebook',
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
  })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  authController.oauthCallback
);

module.exports = router;