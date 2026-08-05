const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

const oauthStateStore = new Map();

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m', issuer: 'trustedhand-api', audience: 'trustedhand-client' }
  );
  const refreshToken = jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', issuer: 'trustedhand-api', audience: 'trustedhand-client' }
  );
  return { accessToken, refreshToken };
};

const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  return { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', maxAge, path: '/' };
};

exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'], session: false });

exports.googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      console.error('[Google Callback] Error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_denied`);
    }
    const state = crypto.randomBytes(32).toString('hex');
    oauthStateStore.set(state, { userId: user._id.toString(), createdAt: Date.now() });
    const now = Date.now();
    for (const [key, val] of oauthStateStore.entries()) {
      if (now - val.createdAt > 5 * 60 * 1000) oauthStateStore.delete(key);
    }
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?provider=google&state=${state}`);
  })(req, res, next);
};

exports.facebookAuth = passport.authenticate('facebook', { scope: ['email'], session: false });

exports.facebookCallback = (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (ua.includes('facebookexternalhit') || ua.includes('Facebot')) {
    console.log('[Facebook] Blocked crawler from consuming auth code');
    return res.status(403).send('Forbidden');
  }
  passport.authenticate('facebook', { session: false }, (err, user) => {
    if (err) {
      console.error('[Facebook Callback] Error:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_denied`);
    }
    const state = crypto.randomBytes(32).toString('hex');
    oauthStateStore.set(state, { userId: user._id.toString(), createdAt: Date.now() });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?provider=facebook&state=${state}`);
  })(req, res, next);
};

exports.exchangeOAuthState = async (req, res) => {
  try {
    const { state } = req.query;
    log('[OAuth Exchange] State received:', state ? 'yes' : 'no');
    if (!state || !oauthStateStore.has(state)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATE', message: 'Invalid or expired state' } });
    }
    const { userId } = oauthStateStore.get(state);
    oauthStateStore.delete(state);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }
    const { accessToken, refreshToken } = generateTokens(user._id);
    log('[OAuth Exchange] Tokens generated for:', user.email);
    if (user.addRefreshToken) {
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth');
    }
    res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
    let unreadCount = 0;
    try {
      const { Conversation } = require('../models');
      if (Conversation?.getTotalUnreadCount) {
        unreadCount = await Conversation.getTotalUnreadCount(user._id);
      }
    } catch {
      unreadCount = 0;
    }
    res.json({
      success: true,
      data: {
        user: user.toJSON ? user.toJSON() : user,
        accessToken,
        refreshToken,
        unreadMessageCount: unreadCount,
        dashboardRoute: user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard'
      }
    });
  } catch (error) {
    console.error('[OAuth Exchange] Error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'OAuth exchange failed' } });
  }
};