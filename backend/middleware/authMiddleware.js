const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ==========================================
// FIXED: Unified JWT environment variable names
// All files now use these exact names:
//   JWT_SECRET         (access token signing)
//   JWT_REFRESH_SECRET (refresh token signing)
//   JWT_EXPIRE         (access token expiry, e.g. '15m', '1h')
//   JWT_REFRESH_EXPIRE (refresh token expiry, e.g. '7d', '30d')
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

// Validate at module load (fail fast)
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set');
  process.exit(1);
}
if (!JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_REFRESH_SECRET is not set');
  process.exit(1);
}

// In-memory blacklist (lost on restart — use DB for production)
const tokenBlacklist = new Set();

const authMiddleware = {
  /**
   * Generate access + refresh tokens
   */
  generateTokens: (user) => {
    const payload = {
      userId: user._id.toString(),
      id: user._id.toString(), // FIXED: Both fields for backward compatibility
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

  /**
   * Verify access token
   */
  verifyAccessToken: (token) => {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client',
    });
  },

  /**
   * Verify refresh token
   */
  verifyRefreshToken: (token) => {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  },

  /**
   * Add token to blacklist (on logout)
   */
  blacklistToken: (token) => {
    tokenBlacklist.add(token);
  },

  /**
   * Check if token is blacklisted
   */
  isTokenBlacklisted: (token) => {
    return tokenBlacklist.has(token);
  },

  /**
   * Main authentication middleware
   * FIXED: Now checks DB-backed blacklist in addition to in-memory
   */
  authenticate: async (req, res, next) => {
    try {
      let token = null;

      // 1. Check Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }

      // 2. Check cookies as fallback
      if (!token && req.cookies?.token) {
        token = req.cookies.token;
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_NO_TOKEN', message: 'No authentication token provided' }
        });
      }

      // 3. Check in-memory blacklist
      if (authMiddleware.isTokenBlacklisted(token)) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_TOKEN_REVOKED', message: 'Token has been revoked' }
        });
      }

      // 4. Verify token
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

      // 5. Check DB-backed blacklist (user.blacklistedTokens)
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

      // 6. Attach user to request
      req.user = {
        _id: user._id,
        id: user._id, // FIXED: Both for compatibility
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

  /**
   * Role-based authorization middleware
   */
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