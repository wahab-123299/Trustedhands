const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

// ==========================================
// PASSPORT SERIALIZATION
// ==========================================
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// ==========================================
// GOOGLE STRATEGY
// ==========================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/google/callback',
      scope: ['profile', 'email'],
      state: true,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const displayName = profile.displayName;
      const photos = profile.photos;
      const googleId = profile.id;

      if (!email) {
        return done(new Error('No email found in Google profile'), null);
      }

      const oauthUser = {
        provider: 'google',
        email: email.toLowerCase(),
        displayName: displayName || 'Google User',
        photos: photos,
        googleId: googleId,
      };

      return done(null, oauthUser);
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
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'photos', 'email'],
      state: true,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      const displayName = profile.displayName;
      const photos = profile.photos;
      const facebookId = profile.id;

      if (!email) {
        return done(new Error('No email found in Facebook profile'), null);
      }

      const oauthUser = {
        provider: 'facebook',
        email: email.toLowerCase(),
        displayName: displayName || 'Facebook User',
        photos: photos,
        facebookId: facebookId,
      };

      return done(null, oauthUser);
    }
  )
);

module.exports = passport;