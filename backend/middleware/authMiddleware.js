const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../utils/errorHandler');

const extractToken = (req) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  
  return null;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Session expired. Please login.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid token format.');
    }
    throw new AppError('AUTH_UNAUTHORIZED', 'Token verification failed.');
  }
};

exports.authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Access denied. No token provided.');
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId)
      .select('_id email role fullName phone isActive profileImage location');

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User no longer exists.');
    }

    if (!user.isActive) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Account deactivated.');
    }

    const userWithTokens = await User.findById(decoded.userId)
      .select('blacklistedTokens');
    
    const isBlacklisted = userWithTokens.blacklistedTokens?.some(
      bt => bt.token === token
    );
    
    if (isBlacklisted) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Token revoked.');
    }

    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('AUTH_UNAUTHORIZED', 'Authentication required.'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        'AUTH_UNAUTHORIZED', 
        `Access denied. Required: ${roles.join(' or ')}.`
      ));
    }
    
    next();
  };
};

exports.requireVerifiedArtisan = async (req, res, next) => {
  try {
    if (req.user.role !== 'artisan') {
      throw new AppError('AUTH_UNAUTHORIZED', 'Artisan account required.');
    }

    const { ArtisanProfile } = require('../models');
    const profile = await ArtisanProfile.findOne({ userId: req.user._id })
      .select('isCertified idVerification.isVerified')
      .lean();

    if (!profile) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Complete your profile first.');
    }

    req.artisanProfile = profile;
    next();
  } catch (error) {
    next(error);
  }
};

exports.optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    
    if (!token) return next();

    try {
      const decoded = verifyToken(token);
      
      const user = await User.findById(decoded.userId)
        .select('_id email role fullName isActive')
        .lean();

      if (user?.isActive) {
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
      // Silent fail for optional auth
    }

    next();
  } catch (error) {
    next();
  }
};

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
        throw new AppError('AUTH_TOKEN_EXPIRED', 'Refresh token expired.');
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
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid refresh token.');
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    next(error);
  }
};