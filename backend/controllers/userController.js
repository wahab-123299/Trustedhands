const { User, ArtisanProfile, Wallet } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.role === 'artisan') {
      let artisanProfile = await ArtisanProfile.findOne({ userId: user._id })
        .populate('walletId');
      
      // ✅ AUTO-CREATE PROFILE IF MISSING (with duplicate check)
      if (!artisanProfile) {
        console.log(`Creating missing artisan profile for user: ${user._id}`);
        
        try {
          // Double-check if profile was created by another request
          const existingProfile = await ArtisanProfile.findOne({ userId: user._id });
          if (existingProfile) {
            artisanProfile = existingProfile;
            console.log('Profile already exists, using existing');
          } else {
            // Create wallet first
            const wallet = await Wallet.create({
              artisanId: user._id,
              bankDetails: {}
            });
            
            // Create artisan profile with defaults
            artisanProfile = await ArtisanProfile.create({
              userId: user._id,
              skills: [],
              experienceYears: '0-1',
              rate: {
                amount: 1000,
                period: 'job'
              },
              bio: '',
              portfolioImages: [],
              workRadius: 'any',
              walletId: wallet._id
            });
            console.log('New profile created successfully');
          }
        } catch (err) {
          console.error('Error creating profile:', err.message);
          // If duplicate key error, fetch existing
          if (err.code === 11000) {
            console.log('Duplicate key error, fetching existing profile');
            artisanProfile = await ArtisanProfile.findOne({ userId: user._id });
          } else {
            throw err;
          }
        }
      }
      
      return res.json({
        success: true,
        data: {
          user,
          artisanProfile
        }
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateMe = async (req, res, next) => {
  try {
    const allowedFields = ['fullName', 'phone', 'location'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Update location
exports.updateLocation = async (req, res, next) => {
  try {
    const { state, city, address, coordinates } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        location: { state, city, address, coordinates }
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Update profile image
exports.updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'Please upload an image file.');
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'profile-images');

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profileImage: result.secure_url },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Delete user account
exports.deleteMe = async (req, res, next) => {
  try {
    const { password } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Incorrect password.');
    }

    // Soft delete - deactivate account
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID (public profile)
exports.getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || !user.isActive) {
      throw new AppError('USER_NOT_FOUND', 'User not found.');
    }

    // If artisan, include profile
    if (user.role === 'artisan') {
      const artisanProfile = await ArtisanProfile.findOne({ userId: user._id });
      
      return res.json({
        success: true,
        data: {
          user: {
            _id: user._id,
            fullName: user.fullName,
            role: user.role,
            location: user.location,
            profileImage: user.profileImage,
            isVerified: user.isVerified
          },
          artisanProfile
        }
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          role: user.role,
          location: user.location,
          profileImage: user.profileImage
        }
      }
    });
  } catch (error) {
    next(error);
  }
};