const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User, ArtisanProfile, Wallet } = require('../models');
const { sendEmail } = require('../utils/email');
const { AppError } = require('../utils/errorHandler');

// ==========================================
// TOKEN GENERATION
// ==========================================

const generateTokens = (userId) => {
  console.log('[JWT] Using secret:', process.env.JWT_SECRET?.substring(0, 10) + '...');
  console.log('[JWT] Refresh secret:', process.env.JWT_REFRESH_SECRET?.substring(0, 10) + '...');

  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '15m',
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client'
    }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: 'trustedhand-api',
      audience: 'trustedhand-client'
    }
  );

  return { accessToken, refreshToken };
};

// ==========================================
// VALIDATION RULES
// ==========================================

const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .matches(/^(0[7-9][0-1]\d{8}|\+234[7-9][0-1]\d{8})$/)
    .withMessage('Please provide a valid Nigerian phone number (e.g., 08012345678)'),
  body('role')
    .isIn(['customer', 'artisan'])
    .withMessage('Role must be customer or artisan'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ max: 100 })
    .withMessage('Full name cannot exceed 100 characters'),
  body('location.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  body('location.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('location.coordinates.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('location.coordinates.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude')
];

// ==========================================
// HELPER: Get cookie settings
// ==========================================

const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

  console.log('[Cookies] Environment:', isProduction ? 'production' : 'development');
  console.log('[Cookies] Setting secure:', isProduction);
  console.log('[Cookies] Setting sameSite:', isProduction ? 'none' : 'lax');

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
};

// ==========================================
// REGISTRATION
// ==========================================

exports.register = [
  ...registerValidation,
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please check your input and try again.',
            details: errors.array().map(e => ({
              field: e.param,
              message: e.msg
            }))
          }
        });
      }

      const {
        email,
        password,
        role,
        fullName,
        phone,
        location,
        profileImage,
        skills,
        experienceYears,
        rate,
        idVerification,
        bio,
        portfolioImages,
        workRadius,
        bankDetails
      } = req.body;

      // Normalize phone number
      const normalizedPhone = phone.replace(/^\+234/, '0').replace(/\s/g, '');

      // Check if user exists
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { phone: { $in: [phone, normalizedPhone, '+234' + normalizedPhone.slice(1)] } }
        ]
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          throw new AppError('USER_EXISTS', 'An account with this email already exists. Please login instead.');
        }
        throw new AppError('USER_PHONE_EXISTS', 'This phone number is already registered.');
      }

      // Convert coordinates to GeoJSON
      let locationData = {
        state: location.state,
        city: location.city,
        address: location.address || ''
      };

      if (location.coordinates?.lat && location.coordinates?.lng) {
        locationData.coordinates = {
          type: 'Point',
          coordinates: [
            parseFloat(location.coordinates.lng),
            parseFloat(location.coordinates.lat)
          ]
        };
      }

      // Create user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        role,
        fullName: fullName.trim(),
        phone: normalizedPhone,
        location: locationData,
        profileImage: profileImage || '/default-avatar.png'
      });

      // Create artisan profile
      if (role === 'artisan') {
        if (!skills || !Array.isArray(skills) || skills.length === 0) {
          throw new AppError('VALIDATION_ERROR', 'At least one skill is required for artisans.');
        }

        if (!rate || !rate.amount || !rate.period) {
          throw new AppError('VALIDATION_ERROR', 'Rate amount and period are required for artisans.');
        }

        const minRates = {
          '0-1': 500,
          '1-3': 1000,
          '3-5': 2000,
          '5-10': 3000,
          '10+': 5000
        };

        const minRate = minRates[experienceYears] || 500;
        if (rate.amount < minRate) {
          throw new AppError('VALIDATION_ERROR', `Minimum rate for ${experienceYears} experience is ₦${minRate}.`);
        }

        const artisanProfile = await ArtisanProfile.create({
          userId: user._id,
          profession: skills?.[0] || 'General Service',
          skills,
          experienceYears: experienceYears || '0-1',
          rate: {
            amount: parseFloat(rate.amount),
            period: rate.period
          },
          idVerification: idVerification || {},
          bio: bio || '',
          portfolioImages: portfolioImages || [],
          workRadius: workRadius || 'any',
          bankDetails: bankDetails || {}
        });

        // Create wallet
        const wallet = await Wallet.create({
          artisanId: user._id,
          bankDetails: bankDetails || {}
        });

        artisanProfile.walletId = wallet._id;
        await artisanProfile.save();
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      user.emailVerificationToken = hashedVerificationToken;
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();

      // Send email
      try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendEmail({
          to: user.email,
          subject: 'Verify Your Email - TrustedHand',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #10B981;">Welcome to TrustedHand!</h1>
              <p>Hi ${user.fullName},</p>
              <p>Thank you for registering. Please click the link below to verify your email:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verify Email
                </a>
              </div>
              <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
              <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'unknown');

      // Set cookies
      res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

      console.log('[Register] Success - Token sent, length:', accessToken.length);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify.',
        data: {
          user: user.toJSON(),
          accessToken,
          dashboardRoute: role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard'
        }
      });
    } catch (error) {
      next(error);
    }
  }
];

// ==========================================
// LOGIN - WITH DEBUG LOGGING
// ==========================================

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    console.log('=== LOGIN DEBUG ===');
    console.log('Email received:', email);
    console.log('Password received:', password ? '**** (hidden)' : 'EMPTY');
    console.log('Password length:', password?.length);

    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Please provide email and password.');
    }

    // Use the static method for consistency
    const user = await User.findByEmailWithPassword(email.toLowerCase());

    console.log('User found:', !!user);

    if (!user) {
      console.log('User not found in database for email:', email.toLowerCase());
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    console.log('User ID:', user._id);
    console.log('User email:', user.email);
    console.log('User role:', user.role);
    console.log('User isActive:', user.isActive);
    console.log('Stored password exists:', !!user.password);
    console.log('Stored password type:', typeof user.password);
    console.log('Stored password length:', user.password?.length);
    
    if (user.password) {
      const isHash = user.password.startsWith('$2');
      console.log('Stored password is bcrypt hash:', isHash);
      console.log('Stored password prefix:', user.password.substring(0, 15) + '...');
    }

    if (!user.isActive) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated.');
    }

    const isPasswordValid = await user.comparePassword(password);
    console.log('Final password validation result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Password mismatch - rejecting login');
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    await user.updateLastLogin();

    const { accessToken, refreshToken } = generateTokens(user._id);
    await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100));

    let unreadCount = 0;
    try {
      const { Conversation } = require('../models');
      if (Conversation?.getTotalUnreadCount) {
        unreadCount = await Conversation.getTotalUnreadCount(user._id);
      }
    } catch (e) {
      unreadCount = 0;
    }

    res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    
    console.log('[Login] SUCCESS for user:', user.email);
    console.log('===================');

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        accessToken,
        unreadMessageCount: unreadCount,
        dashboardRoute: user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard'
      }
    });
  } catch (error) {
    console.log('===================');
    next(error);
  }
};

// ==========================================
// LOGOUT
// ==========================================

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    const accessToken = req.token || req.cookies.accessToken;

    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { token: refreshToken } }
      });

      if (accessToken) {
        await User.findByIdAndUpdate(req.user._id, {
          $push: { 
            blacklistedTokens: { 
              token: accessToken, 
              blacklistedAt: new Date() 
            } 
          }
        });
      }
    }

    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.RENDER === 'true',
      sameSite: (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'none' : 'lax',
      path: '/'
    };

    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REFRESH TOKEN
// ==========================================

exports.refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    console.log('[Refresh] Token from cookie:', !!req.cookies.refreshToken);
    console.log('[Refresh] Token from body:', !!req.body.refreshToken);

    if (!refreshToken) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Refresh token not found.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
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
      throw new AppError('AUTH_UNAUTHORIZED', 'Security violation detected.');
    }

    const tokens = generateTokens(user._id);

    await User.findByIdAndUpdate(user._id, {
      $pull: { refreshTokens: { token: refreshToken } },
      $push: { 
        refreshTokens: { 
          token: tokens.refreshToken, 
          createdAt: new Date(),
          deviceInfo: req.headers['user-agent']?.substring(0, 100) || 'unknown'
        } 
      }
    });

    res.cookie('accessToken', tokens.accessToken, getCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// EMAIL VERIFICATION
// ==========================================

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token || token.length !== 64) {
      throw new AppError('VALIDATION_ERROR', 'Invalid token format.');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or expired token.');
    }

    user.isEmailVerified = true;
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully.'
    });
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('VALIDATION_ERROR', 'Email is required.');
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'If valid, a verification email has been sent.'
      });
    }

    const timeSinceLast = Date.now() - (user.emailVerificationExpires - 24 * 60 * 60 * 1000);
    if (timeSinceLast < 5 * 60 * 1000) {
      throw new AppError('RATE_LIMIT', 'Please wait 5 minutes.');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - TrustedHand',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h1 style="color: #10B981;">Email Verification</h1>
            <p>Hi ${user.fullName},</p>
            <p>Click to verify:</p>
            <a href="${verificationUrl}" style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
            <p style="color: #999; font-size: 12px;">Expires in 24 hours.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      throw new AppError('SERVER_ERROR', 'Failed to send email.');
    }

    res.json({
      success: true,
      message: 'Verification email sent.'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PASSWORD RESET
// ==========================================

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('VALIDATION_ERROR', 'Email is required.');
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset email has been sent.'
      });
    }

    if (user.passwordResetExpires && (Date.now() - (user.passwordResetExpires - 60 * 60 * 1000)) < 10 * 60 * 1000) {
      throw new AppError('RATE_LIMIT', 'Please wait 10 minutes.');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Password Reset - TrustedHand',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h1 style="color: #10B981;">Password Reset</h1>
            <p>Hi ${user.fullName},</p>
            <p>Click to reset:</p>
            <a href="${resetUrl}" style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
            <p style="color: #999; font-size: 12px;">Expires in 1 hour.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      throw new AppError('SERVER_ERROR', 'Failed to send reset email.');
    }

    res.json({
      success: true,
      message: 'Password reset email sent.'
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token || token.length !== 64) {
      throw new AppError('VALIDATION_ERROR', 'Invalid token format.');
    }

    if (!password || password.length < 8) {
      throw new AppError('VALIDATION_ERROR', 'Password must be 8+ characters.');
    }

    if (password !== confirmPassword) {
      throw new AppError('VALIDATION_ERROR', 'Passwords do not match.');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new AppError('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and number.');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or expired token.');
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. Please login.'
    });
  } catch (error) {
    next(error);
  }
};