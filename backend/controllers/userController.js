const { User, ArtisanProfile, Wallet } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');

// ✅ HELPER: Transform artisan data to match frontend expectations
const transformArtisan = (artisan) => {
  if (!artisan || !artisan.userId) return null;

  // Handle both populated and unpopulated userId
  const userData = typeof artisan.userId === 'object' ? artisan.userId : null;
  const userId = userData ? userData._id?.toString() : artisan.userId?.toString();

  return {
    id: artisan._id.toString(),
    profession: artisan.profession,
    skills: artisan.skills || [],
    bio: artisan.bio,
    experienceYears: artisan.experienceYears,
    rate: {
      amount: artisan.rate?.amount || 0,
      period: artisan.rate?.period || 'job'
    },
    averageRating: artisan.averageRating || 0,
    totalReviews: artisan.totalReviews || 0,
    completedJobs: artisan.completedJobs || 0,
    name: userData?.fullName || 'Unknown',
    fullName: userData?.fullName || 'Unknown',
    email: userData?.email,
    phone: userData?.phone,
    location: userData?.location,
    profileImage: userData?.profileImage,
    isVerified: userData?.isVerified,
    userId: userId,
    availability: {
      status: artisan.availability?.status || 'available',
      nextAvailableDate: artisan.availability?.nextAvailableDate
    },
    isAvailable: artisan.availability?.status === 'available',
    availabilityStatus: artisan.availability?.status,
    nextAvailableDate: artisan.availability?.nextAvailableDate,
    workRadius: artisan.workRadius,
    hourlyRate: artisan.rate?.amount,
    ratePeriod: artisan.rate?.period,
    rating: artisan.averageRating,
    reviewCount: artisan.totalReviews,
    portfolioImages: artisan.portfolioImages || [],
    idVerification: artisan.idVerification,
    isCertified: artisan.isCertified,
    canApplyForHighValueJobs: artisan.canApplyForHighValueJobs,
    createdAt: artisan.createdAt,
    updatedAt: artisan.updatedAt
  };
};

// Get current user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.role === 'artisan') {
      // ✅ FIXED: Populate userId immediately so transformArtisan works
      let artisanProfile = await ArtisanProfile.findOne({ userId: user._id })
        .populate('userId', 'fullName email phone profileImage location isVerified')
        .populate('walletId');
      
      // ✅ AUTO-CREATE PROFILE IF MISSING (with duplicate check)
      if (!artisanProfile) {
        console.log(`[getMe] Creating missing artisan profile for user: ${user._id}`);
        
        try {
          // Double-check if profile was created by another request
          const existingProfile = await ArtisanProfile.findOne({ userId: user._id })
            .populate('userId', 'fullName email phone profileImage location isVerified');
          
          if (existingProfile) {
            artisanProfile = existingProfile;
            console.log('[getMe] Profile already exists, using existing');
          } else {
            // Create wallet first (check if exists)
            let wallet = await Wallet.findOne({ artisanId: user._id });
            if (!wallet) {
              wallet = await Wallet.create({
                artisanId: user._id,
                bankDetails: {}
              });
            }
            
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
            
            // Re-populate after creation
            await artisanProfile.populate('userId', 'fullName email phone profileImage location isVerified');
            console.log('[getMe] New profile created successfully');
          }
        } catch (err) {
          console.error('[getMe] Error creating profile:', err.message);
          // If duplicate key error, fetch existing
          if (err.code === 11000) {
            console.log('[getMe] Duplicate key error, fetching existing profile');
            artisanProfile = await ArtisanProfile.findOne({ userId: user._id })
              .populate('userId', 'fullName email phone profileImage location isVerified');
          } else {
            throw err;
          }
        }
      }
      
      // ✅ FIXED: Transform artisan profile (userId is now populated)
      const transformedProfile = artisanProfile ? transformArtisan(artisanProfile) : null;
      
      console.log('[getMe] Returning artisanProfile:', transformedProfile ? 'EXISTS' : 'NULL');
      
      return res.json({
        success: true,
        data: {
          user,
          artisanProfile: transformedProfile
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
      const artisanProfile = await ArtisanProfile.findOne({ userId: user._id })
        .populate('userId', 'fullName email phone profileImage location isVerified');
      
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
          artisanProfile: artisanProfile ? transformArtisan(artisanProfile) : null
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