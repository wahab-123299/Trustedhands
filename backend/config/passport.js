const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });
};

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/oauth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (user) {
          // Link Google ID to existing user
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
        } else {
          // Create new user from Google data
          user = await User.create({
            googleId: profile.id,
            email: email,
            fullName: profile.displayName,
            profileImage: profile.photos[0]?.value,
            role: 'customer',
            isActive: true,
            isEmailVerified: true,
          });
        }

        const token = generateToken(user._id);
        return done(null, { user, token });
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Facebook OAuth Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/oauth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'photos'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Facebook'), false);

        let user = await User.findOne({ email });

        if (user) {
          if (!user.facebookId) {
            user.facebookId = profile.id;
            await user.save();
          }
        } else {
          const fullName = `${profile.name.givenName} ${profile.name.familyName}`;
          user = await User.create({
            facebookId: profile.id,
            email: email,
            fullName: fullName,
            profileImage: profile.photos?.[0]?.value,
            role: 'customer',
            isActive: true,
            isEmailVerified: true,
          });
        }

        const token = generateToken(user._id);
        return done(null, { user, token });
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Required for passport
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;