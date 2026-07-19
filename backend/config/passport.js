// backend/config/passport.js
// ==========================================
// FIXED #38: Set authProvider in findOrCreateOAuthUser
// FIXED #37: OAuth role selection support (oauthPendingRoleSelection flag)
// FIXED #21: Use env vars for callback URLs instead of hardcoded domains
// ==========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { User } = require('../models');

const isDev = process.env.NODE_ENV !== 'production';
const log = (...args) => { if (isDev) console.log(...args); };

// ==========================================
// Serialize/deserialize by user ID only
// We use JWT, not sessions, but Passport needs these
// ==========================================
passport.serializeUser((user, done) => {
  done(null, user._id.toString());
});

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
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // FIXED #21: Use env var for callback URL, fallback to BACKEND_URL
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL || 'https://trustedhands.onrender.com'}/api/auth/google/callback`,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      log('[Passport Google] Profile:', profile.displayName, profile.emails?.[0]?.value);

      // FIXED #38: Pass provider so findOrCreateOAuthUser can set authProvider
      const user = await User.findOrCreateOAuthUser(profile, 'google');

      // Check if this is a new user (created within last 5 seconds)
      const isNewUser = Date.now() - new Date(user.createdAt).getTime() < 5000;
      user._isNewUser = isNewUser;

      // FIXED #38: authProvider already set in findOrCreateOAuthUser
      log('[Passport Google] User:', user.email, 'isNew:', isNewUser, 'provider:', user.authProvider);
      return done(null, user);
    } catch (error) {
      log('[Passport Google] Error:', error.message);
      return done(error, null);
    }
  }));
} else {
  console.warn('[Passport] Google OAuth credentials not configured');
}

// ==========================================
// FACEBOOK STRATEGY
// ==========================================
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    // FIXED #21: Use env var for callback URL
    callbackURL: process.env.FACEBOOK_CALLBACK_URL || `${process.env.BACKEND_URL || 'https://trustedhands.onrender.com'}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email', 'name'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      log('[Passport Facebook] Profile:', profile.displayName, profile.emails?.[0]?.value);

      // FIXED #38: Pass provider so findOrCreateOAuthUser can set authProvider
      const user = await User.findOrCreateOAuthUser(profile, 'facebook');

      const isNewUser = Date.now() - new Date(user.createdAt).getTime() < 5000;
      user._isNewUser = isNewUser;

      log('[Passport Facebook] User:', user.email, 'isNew:', isNewUser, 'provider:', user.authProvider);
      return done(null, user);
    } catch (error) {
      log('[Passport Facebook] Error:', error.message);
      return done(error, null);
    }
  }));
} else {
  console.warn('[Passport] Facebook OAuth credentials not configured');
}

module.exports = passport;