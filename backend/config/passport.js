const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

// ==========================================
// GOOGLE STRATEGY
// ==========================================

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL}/api/auth/google/callback`,
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        return done(null, false, { message: 'No email found in Google profile' });
      }

      return done(null, {
        provider: 'google',
        googleId: profile.id,
        email: email,
        displayName: profile.displayName,
        name: profile.name,
        photos: profile.photos
      });
    } catch (error) {
      return done(error, false);
    }
  }
));

// ==========================================
// FACEBOOK STRATEGY
// ==========================================

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.API_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'photos', 'email'],
    proxy: true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        return done(null, false, { message: 'No email found in Facebook profile' });
      }

      return done(null, {
        provider: 'facebook',
        facebookId: profile.id,
        email: email,
        displayName: profile.displayName,
        name: profile.name,
        photos: profile.photos
      });
    } catch (error) {
      return done(error, false);
    }
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;