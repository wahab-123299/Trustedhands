const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const User = require('../models/User');

// ==========================================
// PASSPORT SERIALIZATION
// ==========================================

passport.serializeUser((user, done) => {
  done(null, user._id);
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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        'https://trustedhands.onrender.com/api/auth/google/callback'
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOrCreateOAuthUser(
          profile,
          'google'
        );

        return done(null, user);
      } catch (err) {
        console.error('Google OAuth Error:', err);
        return done(err, null);
      }
    }
  )
);

// ==========================================
// FACEBOOK STRATEGY
// ==========================================

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL:
        process.env.FACEBOOK_CALLBACK_URL ||
        'https://trustedhands.onrender.com/api/auth/facebook/callback',
      profileFields: [
        'id',
        'displayName',
        'emails',
        'photos'
      ]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOrCreateOAuthUser(
          profile,
          'facebook'
        );

        return done(null, user);
      } catch (err) {
        console.error('Facebook OAuth Error:', err);
        return done(err, null);
      }
    }
  )
);

module.exports = passport;