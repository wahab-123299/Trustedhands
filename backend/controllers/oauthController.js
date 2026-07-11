const passport = require('passport');
const { generateTokens } = require('../middleware/authMiddleware');

const authenticateOAuth = (strategy) => {
  return (req, res, next) => {
    passport.authenticate(
      strategy,
      { session: false },
      (err, user, info) => {
        if (err) {
          console.error(`[OAuth Error] ${strategy}:`, err);

          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=oauth_failed`
          );
        }

        if (!user) {
          console.error(
            `[OAuth Error] ${strategy}: No user returned`,
            info
          );

          return res.redirect(
            `${process.env.FRONTEND_URL}/login?error=oauth_failed`
          );
        }

        req.user = user;
        next();
      }
    )(req, res, next);
  };
};

// ==========================================
// GOOGLE
// ==========================================

exports.googleAuth = passport.authenticate(
  'google',
  {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    session: false
  }
);

exports.googleCallback = [
  authenticateOAuth('google'),

  async (req, res) => {
    try {
      const user = req.user;

      const {
        accessToken,
        refreshToken
      } = generateTokens(user._id);

      await user.addRefreshToken(
        refreshToken,
        req.headers['user-agent'] || 'google-oauth'
      );

      await user.updateLastLogin();

      const redirectUrl =
        `${process.env.FRONTEND_URL}` +
        `/oauth/callback` +
        `?token=${accessToken}` +
        `&refreshToken=${refreshToken}` +
        `&role=${user.role}`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error(
        '[Google Callback Error]',
        err
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=server_error`
      );
    }
  }
];

// ==========================================
// FACEBOOK
// ==========================================

exports.facebookAuth = passport.authenticate(
  'facebook',
  {
    scope: ['email'],
    session: false
  }
);

exports.facebookCallback = [
  authenticateOAuth('facebook'),

  async (req, res) => {
    try {
      const user = req.user;

      const {
        accessToken,
        refreshToken
      } = generateTokens(user._id);

      await user.addRefreshToken(
        refreshToken,
        req.headers['user-agent'] || 'facebook-oauth'
      );

      await user.updateLastLogin();

      const redirectUrl =
        `${process.env.FRONTEND_URL}` +
        `/oauth/callback` +
        `?token=${accessToken}` +
        `&refreshToken=${refreshToken}` +
        `&role=${user.role}`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error(
        '[Facebook Callback Error]',
        err
      );

      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=server_error`
      );
    }
  }
];