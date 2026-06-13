const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

console.log('[Passport] Configuring authentication strategies...');
console.log('[Passport] GOOGLE_CLIENT_ID exists?', !!process.env.GOOGLE_CLIENT_ID);
console.log('[Passport] GOOGLE_CLIENT_SECRET exists?', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('[Passport] FACEBOOK_APP_ID exists?', !!process.env.FACEBOOK_APP_ID);
console.log('[Passport] FACEBOOK_APP_SECRET exists?', !!process.env.FACEBOOK_APP_SECRET);

passport.serializeUser((user, done) => {
  done(null, user._id || user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('[Google OAuth] Profile:', profile.id, profile.displayName);
          const user = await User.findOrCreateOAuthUser(profile, 'google');
          return done(null, user);
        } catch (err) {
          console.error('[Google OAuth] Error:', err.message);
          return done(err, null);
        }
      }
    )
  );
  console.log('[Passport] Google strategy registered ✓');
} else {
  console.warn('[Passport] Google strategy NOT registered — missing env vars');
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'photos', 'email', 'name'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('[Facebook OAuth] Profile:', profile.id, profile.displayName);
          const user = await User.findOrCreateOAuthUser(profile, 'facebook');
          return done(null, user);
        } catch (err) {
          console.error('[Facebook OAuth] Error:', err.message);
          return done(err, null);
        }
      }
    )
  );
  console.log('[Passport] Facebook strategy registered ✓');
} else {
  console.warn('[Passport] Facebook strategy NOT registered — missing env vars');
}

module.exports = passport;