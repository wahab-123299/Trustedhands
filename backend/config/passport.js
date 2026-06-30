// config/passport.js
const passport = require('passport');
const User = require('../models/User');

console.log('[Passport] Configuring authentication strategies...');

// Lazy-load OAuth strategies — don't crash if packages missing
let GoogleStrategy, FacebookStrategy;

try {
  GoogleStrategy = require('passport-google-oauth20').Strategy;
  console.log('[Passport] passport-google-oauth20 loaded');
} catch (e) {
  console.warn('[Passport] passport-google-oauth20 not installed. Google OAuth disabled.');
}

try {
  FacebookStrategy = require('passport-facebook').Strategy;
  console.log('[Passport] passport-facebook loaded');
} catch (e) {
  console.warn('[Passport] passport-facebook not installed. Facebook OAuth disabled.');
}

// ==========================================
// SERIALIZATION
// ==========================================
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

// ==========================================
// GOOGLE STRATEGY (optional)
// ==========================================
if (GoogleStrategy && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/google/callback',
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          console.log('[Google OAuth] Profile:', profile.id, profile.displayName);
          const role = req.session?.oauthRole || 'customer';
          const user = await findOrCreateOAuthUser(profile, 'google', role);
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
  console.warn('[Passport] Google strategy NOT registered — missing env vars or package');
}

// ==========================================
// FACEBOOK STRATEGY (optional)
// ==========================================
if (FacebookStrategy && process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'https://trustedhands.onrender.com/api/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'photos', 'email', 'name'],
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          console.log('[Facebook OAuth] Profile:', profile.id, profile.displayName);
          const role = req.session?.oauthRole || 'customer';
          const user = await findOrCreateOAuthUser(profile, 'facebook', role);
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
  console.warn('[Passport] Facebook strategy NOT registered — missing env vars or package');
}

// ==========================================
// UNIFIED USER FIND/CREATE HELPER
// ==========================================
async function findOrCreateOAuthUser(profile, provider, requestedRole) {
  const email = profile.emails?.[0]?.value;
  
  if (!email) {
    throw new Error(`Email not provided by ${provider}`);
  }

  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    console.log(`[OAuth] Existing user found: ${email}`);
    const providerIdField = provider === 'google' ? 'googleId' : 'facebookId';
    
    if (!user[providerIdField]) {
      user[providerIdField] = profile.id;
      await user.save();
      console.log(`[OAuth] Linked ${provider} to existing user`);
    }
    
    user.isNewUser = false;
    return user;
  }

  console.log(`[OAuth] Creating new user from ${provider}: ${email}`);
  
  const userData = {
    email: email.toLowerCase(),
    fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
    firstName: profile.name?.givenName,
    lastName: profile.name?.familyName,
    profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
    role: requestedRole,
    isVerified: true,
    isEmailVerified: true,
    isActive: true,
    authProvider: provider,
    [provider === 'google' ? 'googleId' : 'facebookId']: profile.id,
    password: require('crypto').randomBytes(32).toString('hex'),
  };

  user = await User.create(userData);
  user.isNewUser = true;
  
  console.log(`[OAuth] New user created: ${user._id}, role: ${user.role}`);
  return user;
}

module.exports = passport;