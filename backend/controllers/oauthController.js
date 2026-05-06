const passport = require('passport');

// ==========================================
// CUSTOM AUTHENTICATE WRAPPER (NO SESSION)
// ==========================================

const authenticateOAuth = (strategy) => {
  return (req, res, next) => {
    passport.authenticate(strategy, { session: false }, (err, user, info) => {
      if (err) {
        console.error(`[OAuth Error] ${strategy}:`, err.message);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed&provider=${strategy}`);
      }
      if (!user) {
        console.error(`[OAuth Error] ${strategy}: No user returned. Info:`, info);
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed&provider=${strategy}`);
      }
      req.user = user;
      next();
    })(req, res, next);
  };
};

// ==========================================
// GOOGLE CONTROLLERS
// ==========================================

exports.googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account',
  session: false
});

exports.googleCallback = [
  authenticateOAuth('google'),
  async (req, res) => {
    try {
      const user = req.user;
      const { generateTokens } = require('./authController');
      const { accessToken, refreshToken } = generateTokens(user._id);

      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth-google');

      const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${accessToken}&refresh=${refreshToken}&role=${user.role}`;
      res.redirect(redirectUrl);
    } catch (err) {
      console.error('[Google Callback Error]:', err);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error&provider=google`);
    }
  }
];

// ==========================================
// FACEBOOK CONTROLLERS
// ==========================================

exports.facebookAuth = passport.authenticate('facebook', {
  scope: ['email'],
  session: false
});

exports.facebookCallback = [
  authenticateOAuth('facebook'),
  async (req, res) => {
    try {
      const user = req.user;
      const { generateTokens } = require('./authController');
      const { accessToken, refreshToken } = generateTokens(user._id);

      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'oauth-facebook');

      const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${accessToken}&refresh=${refreshToken}&role=${user.role}`;
      res.redirect(redirectUrl);
    } catch (err) {
      console.error('[Facebook Callback Error]:', err);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error&provider=facebook`);
    }
  }
];