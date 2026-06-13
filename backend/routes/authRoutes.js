const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'fallback-jwt-secret',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-jwt-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

const setTokenCookies = (res, token, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
};

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, role, phone, location } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please provide fullName, email, password and role' }
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: { code: 'DUPLICATE_EMAIL', message: 'Email already registered' }
      });
    }

    const user = await User.create({
      fullName, email: email.toLowerCase(), password, role, phone, location,
      isVerified: false, isEmailVerified: false, isActive: true,
    });

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    setTokenCookies(res, token, refreshToken);

    res.status(201).json({
      success: true, message: 'Account created successfully', token, refreshToken,
      user: {
        id: user._id, fullName: user.fullName, email: user.email, role: user.role,
        isVerified: user.isVerified, isEmailVerified: user.isEmailVerified,
        profileImage: user.profileImage, phone: user.phone, location: user.location,
      }
    });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[Login] Attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please provide email and password' }
      });
    }

    const user = await User.findByEmailWithPassword(email.toLowerCase());
    if (!user) {
      console.log('[Login] User not found:', email);
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Email or password is incorrect' }
      });
    }

    console.log('[Login] User found, checking password...');
    console.log('[Login] Password field exists?', !!user.password);
    console.log('[Login] Password length:', user.password?.length);

    const isMatch = await user.comparePassword(password);
    console.log('[Login] Password match result:', isMatch);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Email or password is incorrect' }
      });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    setTokenCookies(res, token, refreshToken);
    await user.updateLastLogin();

    res.json({
      success: true, message: 'Login successful', token, refreshToken,
      user: {
        id: user._id, fullName: user.fullName, email: user.email, role: user.role,
        isVerified: user.isVerified, isEmailVerified: user.isEmailVerified,
        profileImage: user.profileImage, phone: user.phone, location: user.location,
      }
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// REFRESH TOKEN
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' }
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'fallback-jwt-secret');
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'User not found' } });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);
    setTokenCookies(res, newToken, newRefreshToken);
    res.json({ success: true, token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('[Refresh Token Error]', error);
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
  req.logout?.(() => {});
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET ME
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No account found with that email' } });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    console.log('[Forgot Password] Reset token for', email, ':', resetToken);
    res.json({ success: true, message: 'Password reset email sent', ...(process.env.NODE_ENV === 'development' && { resetToken }) });
  } catch (error) {
    console.error('[Forgot Password Error]', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// RESET PASSWORD
router.put('/reset-password/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const resetToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: resetToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GOOGLE OAUTH
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_failed' }),
  (req, res) => {
    try {
      const user = req.user;
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);
      const redirectUrl = process.env.FRONTEND_URL || 'https://trustedhand.org';
      res.redirect(`${redirectUrl}/oauth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      console.error('[Google Callback Error]', error);
      res.redirect(`${process.env.FRONTEND_URL || 'https://trustedhand.org'}/login?error=oauth_error`);
    }
  }
);

// FACEBOOK OAUTH
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email', 'public_profile']
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login?error=facebook_failed' }),
  (req, res) => {
    try {
      const user = req.user;
      const token = generateToken(user);
      const refreshToken = generateRefreshToken(user);
      const redirectUrl = process.env.FRONTEND_URL || 'https://trustedhand.org';
      res.redirect(`${redirectUrl}/oauth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      console.error('[Facebook Callback Error]', error);
      res.redirect(`${process.env.FRONTEND_URL || 'https://trustedhand.org'}/login?error=oauth_error`);
    }
  }
);

module.exports = router;