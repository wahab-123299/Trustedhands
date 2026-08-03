const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set');
  process.exit(1);
}
if (!JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_REFRESH_SECRET is not set');
  process.exit(1);
}

const tokenBlacklist = new Set();

const authMiddleware = {
  generateTokens: (user) => {
    const payload = {
      userId: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client',
    });

    const refreshToken = jwt.sign(
      { userId: user._id.toString(), type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRE }
    );

    return { accessToken, refreshToken };
  },

  verifyAccessToken: (token) => {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client',
    });
  },

  verifyRefreshToken: (token) => {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  },

  blacklistToken: (token) => {
    tokenBlacklist.add(token);
  },

  isTokenBlacklisted: (token) => {
    return tokenBlacklist.has(token);
  },

  authenticate: async (req, res, next) => {
    try {
      let token = null;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }

      if (!token) {
        token = req.cookies?.accessToken || req.cookies?.token || req.cookies?.auth_token;
      }

      console.log('[AUTH] Cookie names found:', req.cookies ? Object.keys(req.cookies) : 'none');
      console.log('[AUTH] Token resolved:', !!token);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_NO_TOKEN', message: 'No authentication token provided' }
        });
      }

      if (authMiddleware.isTokenBlacklisted(token)) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked' }
        });
      }

      let decoded;
      try {
        decoded = authMiddleware.verifyAccessToken(token);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: { code: 'AUTH_TOKEN_EXPIRED', message: 'Token has expired' }
          });
        }
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid token' }
        });
      }

      const user = await User.findById(decoded.userId || decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_USER_NOT_FOUND', message: 'User not found' }
        });
      }

      if (user.blacklistedTokens && user.blacklistedTokens.includes(token)) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked' }
        });
      }

      req.user = {
        _id: user._id,
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      };
      req.token = token;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Authentication error' }
      });
    }
  },

  authorize: (...roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_UNAUTHORIZED', message: 'Not authenticated' }
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'AUTH_FORBIDDEN', message: 'Insufficient permissions' }
        });
      }

      next();
    };
  },
};

module.exports = authMiddleware;