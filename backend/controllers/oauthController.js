const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { User } = require('../models');

// ==========================================
// GOOGLE STRATEGY
// ==========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email from Google'), null);
      }

      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        if (!user.googleId) {
          user.googleId = profile.id;
          await user.save();
        }
        return done(null, user);
      }

      user = await User.create({
        email: email.toLowerCase(),
        fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
        profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
        role: 'customer',
        googleId: profile.id,
        isActive: true,
        isEmailVerified: true
      });

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// ==========================================
// FACEBOOK STRATEGY
// ==========================================
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email', 'name']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email from Facebook'), null);
      }

      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        if (!user.facebookId) {
          user.facebookId = profile.id;
          await user.save();
        }
        return done(null, user);
      }

      user = await User.create({
        email: email.toLowerCase(),
        fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
        profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
        role: 'customer',
        facebookId: profile.id,
        isActive: true,
        isEmailVerified: true
      });

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
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
// CONTROLLER METHODS — SESSION: FALSE ADDED
// ==========================================

exports.googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
  session: false  // ← ADDED
});

exports.googleCallback = [
  passport.authenticate('google', { 
    failureRedirect: '/login?error=oauth_failed',
    session: false  // ← ADDED
  }),
  async (req, res) => {
    try {
      const user = req.user;
      const { generateTokens } = require('./authController');
      const { accessToken, refreshToken } = generateTokens(user._id);
      
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth-google');

      // FIXED: Changed from /oauth-callback to /oauth/callback
      const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${accessToken}&refresh=${refreshToken}&role=${user.role}`;
      res.redirect(redirectUrl);
    } catch (err) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
];

exports.facebookAuth = passport.authenticate('facebook', {
  scope: ['email'],
  session: false  // ← ADDED
});

exports.facebookCallback = [
  passport.authenticate('facebook', { 
    failureRedirect: '/login?error=oauth_failed',
    session: false  // ← ADDED
  }),
  async (req, res) => {
    try {
      const user = req.user;
      const { generateTokens } = require('./authController');
      const { accessToken, refreshToken } = generateTokens(user._id);
      
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth-facebook');

      // FIXED: Changed from /oauth-callback to /oauth/callback
      const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${accessToken}&refresh=${refreshToken}&role=${user.role}`;
      res.redirect(redirectUrl);
    } catch (err) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
];