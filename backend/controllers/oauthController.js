const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendWelcomeEmail } = require('../utils/emailService');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

// In-memory state store (use Redis in production)
const oauthStateStore = new Map();

// ==========================================
// Token generation — EXACT same shape as authController
// ==========================================
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client'
    }
  );

  const refreshToken = jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client'
    }
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
// Passport serialization
// ==========================================
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ==========================================
// GOOGLE STRATEGY
// ==========================================
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.API_URL || process.env.BACKEND_URL}/api/auth/google/callback`,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'), null);

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
        profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        password: crypto.randomBytes(32).toString('hex'),
      });

      try {
        await sendWelcomeEmail(user.email, user.fullName);
      } catch (e) {
        console.error('[Google OAuth] Welcome email failed:', e.message);
      }
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// ==========================================
// FACEBOOK STRATEGY
// ==========================================
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: `${process.env.API_URL || process.env.BACKEND_URL}/api/auth/facebook/callback`,
  profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Facebook'), null);

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        fullName: profile.displayName,
        profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        password: crypto.randomBytes(32).toString('hex'),
      });
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

// ==========================================
// CONTROLLER EXPORTS
// ==========================================

exports.googleAuth = passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
});

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
    oauthStateStore.set(state, { 
      userId: user._id.toString(), 
      createdAt: Date.now() 
    });

    // Cleanup old states (>5 min)
    const now = Date.now();
    for (const [key, val] of oauthStateStore.entries()) {
      if (now - val.createdAt > 5 * 60 * 1000) oauthStateStore.delete(key);
    }

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?provider=google&state=${state}`);
  })(req, res, next);
};

exports.facebookAuth = passport.authenticate('facebook', { 
  scope: ['email'],
  session: false 
});

exports.facebookCallback = (req, res, next) => {
  // Safety net: block Facebook crawler
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
    oauthStateStore.set(state, { 
      userId: user._id.toString(), 
      createdAt: Date.now() 
    });

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?provider=facebook&state=${state}`);
  })(req, res, next);
};

/**
 * GET /api/auth/oauth-exchange
 * CRITICAL: Signs token with userId and sets accessToken cookie
 * 
 * NOTE: Export name MUST match the import in routes/auth.js
 */
exports.exchangeOAuthState = async (req, res) => {
  try {
    const { state } = req.query;
    
    log('[OAuth Exchange] State received:', state ? 'yes' : 'no');

    if (!state || !oauthStateStore.has(state)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Invalid or expired state' }
      });
    }

    const { userId } = oauthStateStore.get(state);
    oauthStateStore.delete(state);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }

    // FIXED: Generate tokens with userId (matches middleware expectation)
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    log('[OAuth Exchange] Tokens generated for:', user.email);
    log('[OAuth Exchange] Payload userId:', user._id.toString());

    // Save refresh token (matches login behavior)
    if (user.addRefreshToken) {
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth');
    }

    // FIXED: Set cookies with SAME names as login/register
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

    // Return EXACT same shape as normal login
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
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'OAuth exchange failed' }
    });
  }
};