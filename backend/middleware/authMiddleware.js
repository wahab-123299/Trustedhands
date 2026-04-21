const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

/**
 * Extract token from request (Authorization header or cookies)
 * @param {Object} req - Express request object
 * @returns {String|null} JWT token or null
 */
const extractToken = (req) => {
  // Debug log
  console.log('[Auth Middleware] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Auth Middleware] Authorization header:', req.headers.authorization);
  console.log('[Auth Middleware] Cookies:', req.cookies);

  // Check Authorization header FIRST (what your frontend sends)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];
    console.log('[Auth Middleware] Token extracted from header, length:', token.length);
    return token;
  }
  
  // Fallback to httpOnly cookie
  if (req.cookies?.accessToken) {
    console.log('[Auth Middleware] Token extracted from cookie');
    return req.cookies.accessToken;
  }
  
  console.log('[Auth Middleware] No token found');
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
    console.log('[Auth Middleware] Verifying token with secret:', process.env.JWT_SECRET?.substring(0, 10) + '...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[Auth Middleware] Token verified, userId:', decoded.userId);
    return decoded;
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', error.name, error.message);
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
    console.log('[Auth Middleware] === START AUTHENTICATION ===');
    
    const token = extractToken(req);

    if (!token) {
      console.log('[Auth Middleware] No token provided - rejecting');
      throw new AppError('AUTH_UNAUTHORIZED', 'Access denied. No token provided.');
    }


    const decoded = verifyToken(token);


    console.log('[Auth Middleware] Finding user:', decoded.userId);
    
    // FIXED: Use .lean() to get plain object, not Mongoose document
    const user = await User.findById(decoded.userId)
      .select('_id email role fullName phone isActive profileImage location')
      .lean();

    if (!user) {
      console.log('[Auth Middleware] User not found:', decoded.userId);
      throw new AppError('USER_NOT_FOUND', 'User associated with this token no longer exists.');
    }

    if (!user.isActive) {
      console.log('[Auth Middleware] User deactivated:', user._id);
      throw new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated. Contact support.');
    }

    // Check blacklist
    console.log('[Auth Middleware] Checking blacklist...');
    const userWithTokens = await User.findById(decoded.userId)
      .select('blacklistedTokens')
      .lean();
    
    const isBlacklisted = userWithTokens.blacklistedTokens?.some(
      bt => bt.token === token
    );
    
    if (isBlacklisted) {
      console.log('[Auth Middleware] Token is blacklisted');
      throw new AppError('AUTH_UNAUTHORIZED', 'Token has been revoked. Please login again.');
    }

    // CRITICAL FIX: Ensure _id is a string for downstream controllers
    user._id = user._id.toString();
    
    req.user = user;
    req.token = token;
    
    console.log('[Auth Middleware] === AUTHENTICATION SUCCESS ===');
    console.log('[Auth Middleware] req.user._id:', req.user._id, 'type:', typeof req.user._id);
    next();
  } catch (error) {
    console.error('[Auth Middleware] === AUTHENTICATION FAILED ===', error.message);
    next(error);
  }
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

    const user = await User.findById(decoded.userId).select('+refreshTokens');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found.');
    }

    const tokenExists = user.refreshTokens?.some(rt => rt.token === refreshToken);
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