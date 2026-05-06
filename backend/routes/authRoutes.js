const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const oauthController = require('../controllers/oauthController');
const { authenticate } = require('../middleware/authMiddleware');

// Disable sessions for OAuth
router.use((req, res, next) => {
  req.session = null;
  next();
});
router.use(passport.initialize());

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);

// ==========================================
// OAUTH ROUTES
// ==========================================

// Google
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);

// Facebook
router.get('/facebook', oauthController.facebookAuth);
router.get('/facebook/callback', oauthController.facebookCallback);

// CRITICAL: Facebook error fallback
// Facebook sometimes appends /login to the callback URL on failure
router.get('/facebook/callback/login', (req, res) => {
  const error = req.query.error || 'oauth_failed';
  console.error('[Facebook OAuth Error]:', {
    error,
    query: req.query,
    path: req.path,
    timestamp: new Date().toISOString()
  });
  const frontendUrl = process.env.FRONTEND_URL || 'https://trustedhands.netlify.app';
  res.redirect(`${frontendUrl}/login?error=${error}&provider=facebook`);
});

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);



module.exports = router;