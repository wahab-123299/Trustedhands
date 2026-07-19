const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

// ==========================================
// FIXED: Unified JWT env var names (matches authMiddleware.js + authController.js)
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRE || '7d';

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId: userId.toString() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, audience: 'trustedhand-client', issuer: 'trustedhand-api' }
  );

  const refreshToken = jwt.sign(
    { userId: userId.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN, audience: 'trustedhand-client', issuer: 'trustedhand-api' }
  );

  return { accessToken, refreshToken };
};

const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
};

// ==========================================
// TEMPORARY STATE STORE (for OAuth flow)
// Maps state param -> { userId, isNewUser, role }
// Auto-expires entries after 5 minutes
// In production, use Redis instead
// ==========================================
const oauthStateStore = new Map();

const cleanupExpiredStates = () => {
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (now > value.expiresAt) {
      oauthStateStore.delete(key);
    }
  }
};

// Clean up every 5 minutes
setInterval(cleanupExpiredStates, 5 * 60 * 1000);

const storeOAuthState = (userId, isNewUser, role) => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStateStore.set(state, {
    userId: userId.toString(),
    isNewUser,
    role,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 min expiry
  });
  return state;
};

const getOAuthState = (state) => {
  const data = oauthStateStore.get(state);
  if (data) {
    oauthStateStore.delete(state); // one-time use
  }
  return data;
};

// ==========================================
// GOOGLE OAUTH
// ==========================================

exports.googleAuth = (req, res, next) => {
  const passport = require('passport');
  passport.authenticate('google', {
    scope: ['email', 'profile'],
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
};

exports.googleCallback = [
  (req, res, next) => {
    const passport = require('passport');
    passport.authenticate('google', { session: false })(req, res, next);
  },
  async (req, res) => {
    try {
      // req.user is set by Passport strategy (User document from findOrCreateOAuthUser)
      const user = req.user;

      if (!user) {
        console.error('[OAuth Google] No user from passport');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      log('[OAuth Google] User:', user.email, 'isNew:', user._isNewUser);

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'google-oauth');

      // Set HttpOnly cookies (secure — not in URL!)
      res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

      // Store state for frontend to pick up user info
      const state = storeOAuthState(user._id, user._isNewUser || false, user.role);

      // Determine redirect path
      const dashboardRoute = user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard';
      const redirectPath = (user._isNewUser && user.role === 'artisan') ? '/setup-profile' : dashboardRoute;

      // FIXED: Redirect with ONLY state param (no tokens in URL!)
      const redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?state=${state}&redirect=${encodeURIComponent(redirectPath)}`;

      log('[OAuth Google] Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('[OAuth Google] Error:', error.message);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
];

// ==========================================
// FACEBOOK OAUTH
// ==========================================

exports.facebookAuth = (req, res, next) => {
  const passport = require('passport');
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile']
  })(req, res, next);
};

exports.facebookCallback = [
  (req, res, next) => {
    const passport = require('passport');
    passport.authenticate('facebook', { session: false })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user;

      if (!user) {
        console.error('[OAuth Facebook] No user from passport');
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      log('[OAuth Facebook] User:', user.email, 'isNew:', user._isNewUser);

      const { accessToken, refreshToken } = generateTokens(user._id);
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'facebook-oauth');

      res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

      const state = storeOAuthState(user._id, user._isNewUser || false, user.role);

      const dashboardRoute = user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard';
      const redirectPath = (user._isNewUser && user.role === 'artisan') ? '/setup-profile' : dashboardRoute;

      // FIXED: Redirect with ONLY state param
      const redirectUrl = `${process.env.FRONTEND_URL}/auth-callback?state=${state}&redirect=${encodeURIComponent(redirectPath)}`;

      log('[OAuth Facebook] Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('[OAuth Facebook] Error:', error.message);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
];

// ==========================================
// OAUTH STATE EXCHANGE (called by frontend /auth-callback)
// Frontend exchanges state for user info via API call
// ==========================================

exports.exchangeOAuthState = async (req, res, next) => {
  try {
    const { state } = req.query;

    if (!state) {
      throw new AppError('VALIDATION_ERROR', 'State parameter required');
    }

    const oauthData = getOAuthState(state);

    if (!oauthData) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid or expired state');
    }

    const user = await User.findById(oauthData.userId).select('-password');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found');
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        isNewUser: oauthData.isNewUser,
        role: oauthData.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BACKWARD COMPAT
// ==========================================

exports.oauthSuccess = (req, res) => {
  res.json({ success: true, message: 'OAuth authentication successful' });
};

exports.oauthFailure = (req, res) => {
  res.status(401).json({
    success: false,
    error: { code: 'OAUTH_FAILED', message: 'OAuth authentication failed' }
  });
};