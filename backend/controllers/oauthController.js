const passport = require('passport');
const { User } = require('../models');
const { generateTokens } = require('./authController');

// ==========================================
// CUSTOM AUTHENTICATE WRAPPER
// ==========================================

const authenticateOAuth = (strategy) => {
  return (req, res, next) => {
    passport.authenticate(strategy, { session: false }, (err, oauthProfile, info) => {
      if (err) {
        console.error(`[OAuth Error] ${strategy}:`, err.message);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed&provider=${strategy}`);
      }
      if (!oauthProfile) {
        console.error(`[OAuth Error] ${strategy}: No profile returned. Info:`, info);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed&provider=${strategy}`);
      }

      // Store the OAuth profile on req for the next handler
      req.oauthProfile = oauthProfile;
      next();
    })(req, res, next);
  };
};

// ==========================================
// GOOGLE
// ==========================================

exports.googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
  session: false
});

exports.googleCallback = [
  authenticateOAuth('google'),
  handleOAuthCallback
];

// ==========================================
// FACEBOOK
// ==========================================

exports.facebookAuth = passport.authenticate('facebook', {
  scope: ['email'],
  session: false
});

exports.facebookCallback = [
  authenticateOAuth('facebook'),
  handleOAuthCallback
];

// ==========================================
// SHARED CALLBACK HANDLER
// ==========================================

async function handleOAuthCallback(req, res) {
  try {
    const oauthProfile = req.oauthProfile;

    if (!oauthProfile || !oauthProfile.email) {
      console.error('[OAuth] No email in profile');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    console.log('[OAuth] Provider:', oauthProfile.provider, 'Email:', oauthProfile.email);

    // 1. Find or create user
    let user = await User.findOne({ email: oauthProfile.email.toLowerCase() });
    let isNewUser = false;

    if (user) {
      // Existing user — link OAuth provider if not already linked
      if (!user.authProvider || user.authProvider === 'local') {
        user.authProvider = oauthProfile.provider;
        if (oauthProfile.provider === 'google') user.googleId = oauthProfile.googleId;
        if (oauthProfile.provider === 'facebook') user.facebookId = oauthProfile.facebookId;
        await user.save();
      }
    } else {
      // Create new user from OAuth data
      isNewUser = true;
      const crypto = require('crypto');

      user = await User.create({
        fullName: oauthProfile.displayName || 'OAuth User',
        email: oauthProfile.email.toLowerCase(),
        profileImage: oauthProfile.photos?.[0]?.value || '/default-avatar.png',
        authProvider: oauthProfile.provider,
        googleId: oauthProfile.provider === 'google' ? oauthProfile.googleId : null,
        facebookId: oauthProfile.provider === 'facebook' ? oauthProfile.facebookId : null,
        role: 'customer',
        isVerified: true,
        isEmailVerified: true,
        // Random password — user will never use it, but schema may require it
        password: crypto.randomBytes(32).toString('hex')
      });
    }

    // 2. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // 3. Save refresh token to user (if addRefreshToken exists)
    if (typeof user.addRefreshToken === 'function') {
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth');
    } else {
      // Fallback: push directly to array
      if (!user.refreshTokens) user.refreshTokens = [];
      user.refreshTokens.push({
        token: refreshToken,
        createdAt: new Date(),
        deviceInfo: req.headers['user-agent']?.substring(0, 100) || 'oauth'
      });
      await user.save();
    }

    // 4. Set cookies
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    // 5. Determine redirect
    const dashboardRoute = user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard';
    const redirectPath = isNewUser ? '/setup-profile' : dashboardRoute;

    // MUST match your frontend route: /auth-callback
    const redirectUrl =
    `${process.env.FRONTEND_URL}/auth-callback?token=${accessToken}&refreshToken=${refreshToken}&role=${user.role}`;

    console.log('[OAuth] Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

  } catch (err) {
    console.error('[OAuth Callback] Error:', err.message, err.stack);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error&message=${encodeURIComponent(err.message)}`);
  }
}