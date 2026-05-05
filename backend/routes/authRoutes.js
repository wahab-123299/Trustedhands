const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const oauthController = require('../controllers/oauthController');
const { authenticate } = require('../middleware/authMiddleware');

// FIXED: Only initialize passport, NO session
router.use(passport.initialize());
// REMOVED: router.use(passport.session());

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);


// OAuth routes
router.get('/google', oauthController.googleAuth);
router.get('/google/callback', oauthController.googleCallback);
router.get('/facebook', oauthController.facebookAuth);
router.get('/facebook/callback', oauthController.facebookCallback);


// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refresh);



module.exports = router;