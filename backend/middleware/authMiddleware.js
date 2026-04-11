const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

/**
 * Extract token from request (Authorization header or cookies)
 * @param {Object} req - Express request object
 * @returns {String|null} JWT token or null
 */
const extractToken = (req) => {
  // Check Authorization header FIRST (what your frontend sends)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  
  // Fallback to httpOnly cookie
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  
  return null;
};

/**
 * Verify JWT token and return decoded payload
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 * @throws {AppError} If token is invalid or expired
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Your session has expired. Please login again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid token format.');
    }
    throw new AppError('AUTH_UNAUTHORIZED', 'Token verification failed.');
  }
};

// ==========================================
// MAIN AUTHENTICATION MIDDLEWARE
// ==========================================

/**
 * Authenticate user - Required authentication
 * Verifies JWT, checks user exists, active, and token not blacklisted
 */
exports.authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Access denied. No token provided.');
    }

    // Verify token signature and expiration
    const decoded = verifyToken(token);

    // Find user
    const user = await User.findById(decoded.userId)
      .select('_id email role fullName phone isActive profileImage location');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User associated with this token no longer exists.');
    }

    if (!user.isActive) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated. Contact support.');
    }

    // Check if token is blacklisted
    const userWithTokens = await User.findById(decoded.userId)
      .select('blacklistedTokens');
    
    const isBlacklisted = userWithTokens.blacklistedTokens?.some(
      bt => bt.token === token
    );
    
    if (isBlacklisted) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Token has been revoked. Please login again.');
    }

    // Attach user and token to request for downstream use
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ROLE-BASED AUTHORIZATION
// ==========================================

/**
 * Authorize by role(s)
 * @param  {...String} roles - Allowed roles ('customer', 'artisan', 'admin')
 * @returns {Function} Express middleware
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required.'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        'AUTH_UNAUTHORIZED', 
        `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}.`
      ));
    }
    
    next();
  };
};

// ==========================================
// ARTISAN-SPECIFIC AUTHORIZATION
// ==========================================

/**
 * Check if user is a verified artisan with complete profile
 */
exports.requireVerifiedArtisan = async (req, res, next) => {
  try {
    if (req.user.role !== 'artisan') {
      throw new AppError('AUTH_UNAUTHORIZED', 'This action requires an artisan account.');
    }

    const { ArtisanProfile } = require('../models');
    const profile = await ArtisanProfile.findOne({ userId: req.user._id })
      .select('isCertified idVerification.isVerified')
      .lean();

    if (!profile) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found. Please complete your profile.');
    }

    req.artisanProfile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

// ==========================================
// OPTIONAL AUTHENTICATION
// ==========================================

/**
 * Optional authentication - Attaches user if valid token exists
 * Does NOT fail if no token or invalid token
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next();
    }

    try {
      const decoded = verifyToken(token);
      
      const user = await User.findById(decoded.userId)
        .select('_id email role fullName isActive')
        .lean();

      if (user && user.isActive) {
        const userWithTokens = await User.findById(decoded.userId)
          .select('blacklistedTokens');
          
        const isBlacklisted = userWithTokens.blacklistedTokens?.some(
          bt => bt.token === token
        );
        
        if (!isBlacklisted) {
          req.user = user;
          req.token = token;
        }
      }
    } catch (error) {
      // Silently fail - optional auth should not block request
      if (process.env.NODE_ENV === 'development') {
        console.log('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// ==========================================
// REFRESH TOKEN MIDDLEWARE
// ==========================================

/**
 * Verify refresh token and issue new access token
 */
exports.verifyRefreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Refresh token required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('AUTH_TOKEN_EXPIRED', 'Refresh token expired. Please login again.');
      }
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid refresh token.');
    }

    const user = await User.findById(decoded.userId)
      .select('+refreshTokens');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found.');
    }

    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
    if (!tokenExists) {
      user.refreshTokens = [];
      await user.save();
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid refresh token. Please login again.');
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    next(error);
  }
};