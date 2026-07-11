// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

const tokenBlacklist = new Set();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ==========================================
// AUTHENTICATE (was called 'protect' in old code)
// ==========================================

exports.authenticate = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required. Please log in.'));
    }

    if (tokenBlacklist.has(token)) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Token has been revoked. Please log in again.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, {
        audience: 'trustedhand-client',
        issuer: 'trustedhand-api'
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new AppError('AUTH_TOKEN_EXPIRED', 'Your session has expired. Please log in again.'));
      }
      return next(new AppError('AUTH_UNAUTHORIZED', 'Invalid token. Please log in again.'));
    }

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'User not found. Please log in again.'));
    }

    if (!user.isActive) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated.'));
    }

    req.user = {
      _id: user._id.toString(),
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      profileImage: user.profileImage,
      isVerified: user.isVerified
    };

    next();
  } catch (error) {
    next(new AppError('AUTH_UNAUTHORIZED', 'Authentication failed. Please try again.'));
  }
};

// ==========================================
// AUTHORIZE (Role-based)
// ==========================================

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN', `Access denied. Required role: ${allowedRoles.join(' or ')}`));
    }

    next();
  };
};

// ==========================================
// BACKWARD COMPATIBILITY ALIASES
// ==========================================

exports.protect = exports.authenticate;  // ← OLD ROUTE FILES USE THIS

// ==========================================
// TOKEN HELPERS
// ==========================================

exports.generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId: userId.toString() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, audience: 'trustedhand-client', issuer: 'trustedhand-api' }
  );

  const refreshToken = jwt.sign(
    { userId: userId.toString() },
    JWT_REFRESH_SECRET,  // FIXED: use refresh secret, not JWT_SECRET
    { expiresIn: JWT_REFRESH_EXPIRES_IN, audience: 'trustedhand-client', issuer: 'trustedhand-api' }
  );

  return { accessToken, refreshToken };
};

exports.blacklistToken = (token) => {
  tokenBlacklist.add(token);
};

exports.isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

// ==========================================
// SOCKET.IO AUTH
// ==========================================

exports.socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));
    if (tokenBlacklist.has(token)) return next(new Error('Token revoked'));

    const decoded = jwt.verify(token, JWT_SECRET, {
      audience: 'trustedhand-client',
      issuer: 'trustedhand-api'
    });

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) return next(new Error('User not found or deactivated'));

    socket.user = {
      _id: user._id.toString(),
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};