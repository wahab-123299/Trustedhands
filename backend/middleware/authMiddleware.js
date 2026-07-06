// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

const tokenBlacklist = new Set();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ==========================================
// AUTHENTICATE
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
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required. Please log in.', 401));
    }

    if (tokenBlacklist.has(token)) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Token has been revoked. Please log in again.', 401));
    }

    // Check MongoDB is connected BEFORE querying
    if (mongoose.connection.readyState !== 1) {
      console.error('[Auth] MongoDB not connected (state:', mongoose.connection.readyState + ')');
      return next(new AppError('SERVICE_UNAVAILABLE', 'Database connection lost. Please retry.', 503));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, {
        audience: 'trustedhand-client',
        issuer: 'trustedhand-api'
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new AppError('AUTH_TOKEN_EXPIRED', 'Your session has expired. Please log in again.', 401));
      }
      return next(new AppError('AUTH_UNAUTHORIZED', 'Invalid token. Please log in again.', 401));
    }

    // Query user with timeout to prevent hanging
    const user = await User.findById(decoded.userId)
      .select('-password')
      .maxTimeMS(5000);

    if (!user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'User not found. Please log in again.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated.', 403));
    }

    req.user = {
      _id: user._id.toString(),
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      profileImage: user.profileImage,
      isVerified: user.isVerified
    };

    next();
  } catch (error) {
    console.error('[Auth Middleware] Unexpected error:', error.message);
    next(new AppError('AUTH_UNAUTHORIZED', 'Authentication failed. Please try again.', 403));
  }
};

// ==========================================
// AUTHORIZE
// ==========================================

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required.', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('AUTH_FORBIDDEN', `Access denied. Required: ${allowedRoles.join(' or ')}`, 403));
    }

    next();
  };
};

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

exports.protect = exports.authenticate;

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
    JWT_SECRET,
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
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};