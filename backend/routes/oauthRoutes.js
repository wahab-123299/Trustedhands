const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google Login
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

// Google Callback
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const { user, token } = req.user;
    const userData = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}&user=${userData}`);
  }
);

// Facebook Login
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email'],
  session: false,
}));

// Facebook Callback
router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const { user, token } = req.user;
    const userData = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${process.env.FRONTEND_URL}/oauth-callback?token=${token}&user=${userData}`);
  }
);

module.exports = router;