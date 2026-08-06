const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const emailService = require('../utils/emailService');

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

// OAuth controllers
const {
  googleAuth,
  googleCallback,
  facebookAuth,
  facebookCallback,
  exchangeOAuthState
} = require('../controllers/oauthController');

// ==========================================
// BLOCK FACEBOOK CRAWLER from consuming auth codes
// ==========================================
const blockFacebookCrawler = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('facebookexternalhit') || ua.includes('Facebot')) {
    console.log('[Facebook] Blocked crawler from consuming auth code');
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=facebook_crawler`);
  }
  next();
};


// ==========================================
// TEMPORARY: TEST EMAIL ROUTE — REMOVE AFTER CONFIRMING IT WORKS
// ==========================================
router.get('/test-email', async (req, res) => {
  try {
    const result = await emailService.sendEmail({
      to: 'trusted100@gmail.com',
      subject: 'TrustedHand Brevo Test',
      html: '<h1 style="color:#10B981;">If you see this, Brevo emails are working!</h1>'
    });
    
    if (result.success) {
      res.json({ success: true, message: 'Test email sent to trusted100@gmail.com', id: result.id });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('[Test Email]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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
// OAUTH STATE EXCHANGE
// ==========================================
router.get('/oauth-exchange', exchangeOAuthState);

// ==========================================
// GOOGLE OAUTH ROUTES
// ==========================================

router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);

// ==========================================
// FACEBOOK OAUTH ROUTES
// ==========================================


router.get('/facebook', facebookAuth);
router.get('/facebook/callback', blockFacebookCrawler, facebookCallback);

module.exports = router;