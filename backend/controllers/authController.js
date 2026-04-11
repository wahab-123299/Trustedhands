const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { User, ArtisanProfile, Wallet } = require('../models');
const { sendEmail } = require('../utils/email');
const { AppError } = require('../utils/errorHandler');

// ==========================================
// TOKEN GENERATION
// ==========================================

/**
 * Generate JWT access and refresh tokens
 * @param {String} userId - User ID
 * @returns {Object} { accessToken, refreshToken }
 */
const generateTokens = (userId) => {
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
// REGISTRATION - FIXED
// ==========================================

exports.register = [
  ...registerValidation,
  async (req, res, next) => {
    try {
      // Check validation errors
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

      // CRITICAL FIX: Normalize phone number for comparison
      const normalizedPhone = phone.replace(/^\+234/, '0').replace(/\s/g, '');

      // Check if user already exists
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

      // CRITICAL FIX: Convert coordinates to GeoJSON format
      let locationData = {
        state: location.state,
        city: location.city,
        address: location.address || ''
      };

      if (location.coordinates?.lat && location.coordinates?.lng) {
        locationData.coordinates = {
          type: 'Point',
          coordinates: [
            parseFloat(location.coordinates.lng),  // longitude first (GeoJSON standard)
            parseFloat(location.coordinates.lat)   // latitude second
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

      // Create artisan profile if role is artisan
      if (role === 'artisan') {
        // Validate required artisan fields
        if (!skills || !Array.isArray(skills) || skills.length === 0) {
          throw new AppError('VALIDATION_ERROR', 'At least one skill is required for artisans.');
        }

        if (!rate || !rate.amount || !rate.period) {
          throw new AppError('VALIDATION_ERROR', 'Rate amount and period are required for artisans.');
        }

        // Validate rate amount based on experience
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
          Profession: Profession.trim(),
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

        // Create wallet for artisan
        const wallet = await Wallet.create({
          artisanId: user._id,
          bankDetails: bankDetails || {}
        });

        // Update artisan profile with wallet ID
        artisanProfile.walletId = wallet._id;
        await artisanProfile.save();
      }

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      user.emailVerificationToken = hashedVerificationToken;
      user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await user.save();

      // Send verification email
      try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
        await sendEmail({
          to: user.email,
          subject: 'Verify Your Email - TrustedHand',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #10B981;">Welcome to TrustedHand!</h1>
              <p>Hi ${user.fullName},</p>
              <p>Thank you for registering. Please click the link below to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verify Email
                </a>
              </div>
              <p>Or copy and paste this link:</p>
              <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
              <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                If you didn't create this account, please ignore this email.
              </p>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails - user can resend
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // ✅ FIXED: Use addRefreshToken method (same as login) instead of manual assignment
      await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100) || 'unknown');

      // Set cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: user.toJSON(), // Use toJSON to remove sensitive fields
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
// LOGIN
// ==========================================

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      throw new AppError('VALIDATION_ERROR', 'Please provide email and password.');
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      // Generic error to prevent user enumeration
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Your account has been deactivated. Contact support.');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }

    // Update last login
    await user.updateLastLogin();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Save refresh token (limit to 5 most recent)
    await user.addRefreshToken(refreshToken, req.headers['user-agent']?.substring(0, 100));

    // Get unread message count
    let unreadCount = 0;
    try {
      const { Conversation } = require('../models');
      if (Conversation && typeof Conversation.getTotalUnreadCount === 'function') {
        unreadCount = await Conversation.getTotalUnreadCount(user._id);
      }
    } catch (e) {
      unreadCount = 0;
    }

    // Set cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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
    next(error);
  }
};

// ==========================================
// LOGOUT
// ==========================================

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    const accessToken = req.token || req.cookies.accessToken; // From middleware

    if (req.user && req.user._id) {
      // Remove refresh token from user's list
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: { token: refreshToken } }
      });

      // Blacklist access token if exists
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

    // Clear cookies with same options as when set
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// REFRESH TOKEN - FIXED WITH DEBUG LOGGING
// ==========================================

exports.refresh = async (req, res, next) => {
  try {
    // ✅ FIXED: Accept refresh token from cookie OR body (for flexibility)
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    console.log('=== REFRESH DEBUG ===');
    console.log('Cookie received:', req.cookies.refreshToken ? 'YES' : 'NO');
    console.log('Body received:', req.body.refreshToken ? 'YES' : 'NO');
    console.log('Token exists:', refreshToken ? 'YES' : 'NO');

    if (!refreshToken) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Refresh token not found. Please login again.');
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AppError('AUTH_TOKEN_EXPIRED', 'Refresh token expired. Please login again.');
      }
      throw new AppError('AUTH_UNAUTHORIZED', 'Invalid refresh token.');
    }

    // Find user and check if token exists
    const user = await User.findById(decoded.userId).select('+refreshTokens');
    
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found.');
    }

    console.log('User refreshTokens count:', user.refreshTokens?.length || 0);

    const tokenExists = user.refreshTokens.some(rt => rt.token === refreshToken);
    
    console.log('Token exists in DB:', tokenExists);

    if (!tokenExists) {
      // Security: Token reuse detected - possible theft
      // Invalidate all refresh tokens
      user.refreshTokens = [];
      await user.save();
      throw new AppError('AUTH_UNAUTHORIZED', 'Security violation detected. Please login again.');
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Replace old token with new one (token rotation)
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

    // Set new cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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

    if (!token || token.length !== 64) { // 32 bytes = 64 hex chars
      throw new AppError('VALIDATION_ERROR', 'Invalid verification token format.');
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or expired verification token.');
    }

    // Update user
    user.isEmailVerified = true;
    user.isVerified = true; // Also set general verified flag
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully. You can now access all features.'
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
    
    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists, a verification email has been sent.'
      });
    }

    if (user.isEmailVerified) {
      throw new AppError('VALIDATION_ERROR', 'Email is already verified.');
    }

    // Rate limit: Check last verification email time
    const timeSinceLastEmail = Date.now() - (user.emailVerificationExpires - 24 * 60 * 60 * 1000);
    if (timeSinceLastEmail < 5 * 60 * 1000) { // 5 minutes
      throw new AppError('RATE_LIMIT', 'Please wait 5 minutes before requesting another verification email.');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send verification email
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - TrustedHand',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10B981;">Email Verification</h1>
            <p>Hi ${user.fullName},</p>
            <p>Please click the link below to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      throw new AppError('SERVER_ERROR', 'Failed to send verification email. Please try again later.');
    }

    res.json({
      success: true,
      message: 'Verification email sent successfully.'
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
    
    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists, a password reset email has been sent.'
      });
    }

    // Rate limit: Check last reset request
    const timeSinceLastReset = user.passwordResetExpires 
      ? user.passwordResetExpires - 60 * 60 * 1000 - Date.now() + 60 * 60 * 1000 
      : Infinity;
    
    if (user.passwordResetExpires && timeSinceLastReset < 10 * 60 * 1000) { // 10 minutes
      throw new AppError('RATE_LIMIT', 'Please wait 10 minutes before requesting another reset.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send reset email
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Password Reset - TrustedHand',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #10B981;">Password Reset</h1>
            <p>Hi ${user.fullName},</p>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>
            <p style="color: #999; font-size: 12px;">
              If you didn't request this, please ignore this email or contact support if you're concerned.
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      throw new AppError('SERVER_ERROR', 'Failed to send reset email. Please try again later.');
    }

    res.json({
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    // Validation
    if (!token || token.length !== 64) {
      throw new AppError('VALIDATION_ERROR', 'Invalid reset token format.');
    }

    if (!password || password.length < 8) {
      throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters.');
    }

    if (password !== confirmPassword) {
      throw new AppError('VALIDATION_ERROR', 'Passwords do not match.');
    }

    // Password strength validation
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new AppError('VALIDATION_ERROR', 'Password must contain at least one uppercase letter, one lowercase letter, and one number.');
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or expired reset token.');
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Also clear all refresh tokens for security (force re-login on all devices)
    user.refreshTokens = [];
    
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};