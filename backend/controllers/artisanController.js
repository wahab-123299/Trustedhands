const mongoose = require('mongoose');
const { User, ArtisanProfile, Job } = require('../models');
const { AppError } = require('../utils/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinary');

// ✅ HELPER: Transform artisan data to match frontend expectations
const transformArtisan = (artisan) => {
  if (!artisan || !artisan.userId) return null;

  return {
    id: artisan._id.toString(),
    profession: artisan.profession,
    skills: artisan.skills || [],
    bio: artisan.bio,
    experienceYears: artisan.experienceYears,

    // ✅ MATCHES frontend Profile.tsx expectations
    rate: {
      amount: artisan.rate?.amount || 0,
      period: artisan.rate?.period || 'job'
    },

    // ✅ MATCHES frontend Profile.tsx expectations
    averageRating: artisan.averageRating || 0,
    totalReviews: artisan.totalReviews || 0,
    completedJobs: artisan.completedJobs || 0,

    // User data (frontend expects these)
    name: artisan.userId.fullName,
    fullName: artisan.userId.fullName,
    email: artisan.userId.email,
    phone: artisan.userId.phone,
    location: artisan.userId.location,
    profileImage: artisan.userId.profileImage,
    isVerified: artisan.userId.isVerified,
    userId: artisan.userId._id.toString(),

    // ✅ MATCHES frontend Profile.tsx expectations
    availability: {
      status: artisan.availability?.status || 'available',
      nextAvailableDate: artisan.availability?.nextAvailableDate
    },

    // Keep flattened aliases for other components that use them
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

// ✅ ADDED/UPDATED: Get current logged-in artisan's profile (with auto-create)
exports.getMyProfile = async (req, res, next) => {
  try {
    // First try to find existing profile with populated user
    let artisan = await ArtisanProfile.findOne({ userId: req.user._id })
      .populate('userId', 'fullName email phone profileImage location isVerified');

    // ✅ AUTO-CREATE IF MISSING
    if (!artisan) {
      console.log(`[getMyProfile] Creating missing artisan profile for user: ${req.user._id}`);
      
      try {
        // Check if wallet exists
        let wallet = await Wallet.findOne({ artisanId: req.user._id });
        if (!wallet) {
          wallet = await Wallet.create({
            artisanId: req.user._id,
            bankDetails: {}
          });
        }
        
        // Create artisan profile with defaults
        artisan = await ArtisanProfile.create({
          userId: req.user._id,
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
        
        // Populate after creation
        await artisan.populate('userId', 'fullName email phone profileImage location isVerified');
        console.log('[getMyProfile] New profile created successfully');
      } catch (err) {
        console.error('[getMyProfile] Error creating profile:', err.message);
        if (err.code === 11000) {
          // Duplicate key - fetch existing
          console.log('[getMyProfile] Duplicate key, fetching existing');
          artisan = await ArtisanProfile.findOne({ userId: req.user._id })
            .populate('userId', 'fullName email phone profileImage location isVerified');
        } else {
          throw err;
        }
      }
    }

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan profile not found. Please complete your profile setup.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        artisan: transformArtisan(artisan)
      }
    });
  } catch (error) {
    next(error);
  }
};



// Search artisans by name or skill
exports.searchArtisans = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Search query is required.');
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find users matching name
    const users = await User.find({
      fullName: searchRegex,
      role: 'artisan',
      isActive: true
    }).select('_id');

    const userIds = users.map(u => u._id);

    const exactSkillMatch = await ArtisanProfile.find({
      skills: { $in: [q.trim()] },
      'availability.status': { $ne: 'unavailable' }
    }).distinct('_id');

    const searchConditions = [
      { bio: searchRegex },
      { userId: { $in: userIds } }
    ];

    if (exactSkillMatch.length > 0) {
      searchConditions.push({ _id: { $in: exactSkillMatch } });
    }

    const artisans = await ArtisanProfile.find({
      $or: searchConditions,
      'availability.status': { $ne: 'unavailable' }
    })
      .populate('userId', 'fullName location profileImage isVerified phone email')
      .sort({ averageRating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const activeArtisans = artisans.filter(a => a.userId !== null);

    const total = await ArtisanProfile.countDocuments({
      $or: searchConditions,
      'availability.status': { $ne: 'unavailable' }
    });

    // ✅ FIXED: Transform artisans
    const formattedArtisans = activeArtisans
      .map(transformArtisan)
      .filter(a => a !== null);

    res.json({
      success: true,
      data: {
        artisans: formattedArtisans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get nearby artisans
exports.getNearbyArtisans = async (req, res, next) => {
  try {
    const { lat, lng, radius = 10, page = 1, limit = 10 } = req.query;

    if (!lat || !lng) {
      throw new AppError('VALIDATION_ERROR', 'Latitude and longitude are required.');
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInKm = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusInKm)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid coordinates or radius.');
    }

    const nearbyUsers = await User.find({
      role: 'artisan',
      isActive: true,
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radiusInKm * 1000
        }
      }
    }).select('_id');

    const userIds = nearbyUsers.map(u => u._id);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const artisans = await ArtisanProfile.find({
      userId: { $in: userIds },
      'availability.status': 'available'
    })
      .populate('userId', 'fullName location profileImage isVerified phone email')
      .sort({ averageRating: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ArtisanProfile.countDocuments({
      userId: { $in: userIds },
      'availability.status': 'available'
    });

    // ✅ FIXED: Transform artisans
    const formattedArtisans = artisans
      .map(transformArtisan)
      .filter(a => a !== null);

    res.json({
      success: true,
      data: {
        artisans: formattedArtisans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single artisan details
exports.getArtisanById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid artisan ID format.');
    }

    const artisan = await ArtisanProfile.findOne({ userId: id })
      .populate('userId', 'fullName location profileImage isVerified phone email createdAt isActive');

    if (!artisan || !artisan.userId || !artisan.userId.isActive) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan not found or account is inactive.');
    }

    // Get recent reviews
    const reviews = await Job.find({
      artisanId: id,
      status: 'completed',
      'review.rating': { $exists: true }
    })
      .select('review customerId completedAt')
      .populate('customerId', 'fullName profileImage')
      .sort({ completedAt: -1 })
      .limit(10);

    // ✅ FIXED: Transform artisan and format reviews
    const formattedArtisan = transformArtisan(artisan);

    const formattedReviews = reviews.map(job => ({
      rating: job.review.rating,
      comment: job.review.comment,
      customerName: job.customerId?.fullName,
      customerImage: job.customerId?.profileImage,
      completedAt: job.completedAt
    }));

    res.json({
      success: true,
      data: { 
        artisan: formattedArtisan, 
        reviews: formattedReviews 
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get artisan reviews (unchanged - already returns proper format)
exports.getArtisanReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid artisan ID format.');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Job.find({
      artisanId: id,
      status: 'completed',
      'review.rating': { $exists: true }
    })
      .select('review customerId completedAt')
      .populate('customerId', 'fullName profileImage')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Job.countDocuments({
      artisanId: id,
      status: 'completed',
      'review.rating': { $exists: true }
    });

    const ratingStats = await Job.aggregate([
      { 
        $match: { 
          artisanId: new mongoose.Types.ObjectId(id), 
          status: 'completed', 
          'review.rating': { $exists: true } 
        } 
      },
      { $group: { _id: '$review.rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        ratingStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update artisan profile (artisan only)
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { skills, experienceYears, rate, bio, workRadius, availability } = req.body;

    const artisan = await ArtisanProfile.findOne({ userId });
    if (!artisan) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    if (skills) {
      if (!Array.isArray(skills) || skills.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'At least one skill is required.');
      }
      artisan.skills = skills;
    }

    if (rate) {
      if (rate.amount !== undefined) {
        if (rate.amount < 500) {
          throw new AppError('VALIDATION_ERROR', 'Minimum rate is ₦500.');
        }
        artisan.rate.amount = rate.amount;
      }
      if (rate.period) artisan.rate.period = rate.period;
    }

    if (experienceYears) artisan.experienceYears = experienceYears;
    if (bio !== undefined) artisan.bio = bio;
    if (workRadius) artisan.workRadius = workRadius;
    if (availability) {
      artisan.availability = { 
        ...artisan.availability.toObject(), 
        ...availability 
      };
    }

    await artisan.save();

    // ✅ FIXED: Return transformed artisan
    const updatedArtisan = await ArtisanProfile.findById(artisan._id)
      .populate('userId', 'fullName location profileImage isVerified phone email');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { artisan: transformArtisan(updatedArtisan) }
    });
  } catch (error) {
    next(error);
  }
};

// Update availability (artisan only)
exports.updateAvailability = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, nextAvailableDate } = req.body;

    const validStatuses = ['available', 'unavailable', 'busy'];
    if (!validStatuses.includes(status)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid availability status.');
    }

    const artisan = await ArtisanProfile.findOne({ userId });
    if (!artisan) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    artisan.availability.status = status;
    if (nextAvailableDate) {
      const date = new Date(nextAvailableDate);
      if (isNaN(date.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date format.');
      }
      artisan.availability.nextAvailableDate = date;
    }

    await artisan.save();

    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: { 
        availability: {
          status: artisan.availability.status,
          nextAvailableDate: artisan.availability.nextAvailableDate,
          isAvailable: artisan.availability.status === 'available'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update bank details (artisan only) - unchanged
exports.updateBankDetails = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bankName, accountNumber, accountName, bankCode } = req.body;

    if (!bankName || !accountNumber || !accountName) {
      throw new AppError('VALIDATION_ERROR', 'Bank name, account number, and account name are required.');
    }

    const accountNumberRegex = /^\d{10}$/;
    if (!accountNumberRegex.test(accountNumber)) {
      throw new AppError('VALIDATION_ERROR', 'Account number must be 10 digits.');
    }

    const artisan = await ArtisanProfile.findOne({ userId });
    if (!artisan) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    artisan.bankDetails = {
      bankName,
      accountNumber,
      accountName,
      bankCode: bankCode || '',
      isVerified: false
    };

    await artisan.save();

    const { Wallet } = require('../models');
    await Wallet.findOneAndUpdate(
      { artisanId: userId },
      { bankDetails: artisan.bankDetails, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      data: { bankDetails: artisan.bankDetails }
    });
  } catch (error) {
    next(error);
  }
};

// Upload portfolio images (artisan only)
exports.uploadPortfolioImages = async (req, res, next) => {
  try {
    const userId = req.user._id;

    if (!req.files || req.files.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Please upload at least one image.');
    }

    const artisan = await ArtisanProfile.findOne({ userId });
    if (!artisan) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    const currentImages = artisan.portfolioImages || [];
    const newImagesCount = req.files.length;
    const maxImages = 6;

    if (currentImages.length + newImagesCount > maxImages) {
      throw new AppError(
        'VALIDATION_ERROR', 
        `Maximum ${maxImages} portfolio images allowed. You can upload ${maxImages - currentImages.length} more.`
      );
    }

    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.buffer, 'portfolio-images')
    );

    const uploadResults = await Promise.all(uploadPromises);
    const imageUrls = uploadResults.map(result => result.secure_url);

    artisan.portfolioImages = [...currentImages, ...imageUrls];
    await artisan.save();

    res.json({
      success: true,
      message: 'Portfolio images uploaded successfully',
      data: { portfolioImages: artisan.portfolioImages }
    });
  } catch (error) {
    next(error);
  }
};

// Delete portfolio image (artisan only)
exports.deletePortfolioImage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      throw new AppError('VALIDATION_ERROR', 'Image URL is required.');
    }

    const artisan = await ArtisanProfile.findOne({ userId });
    if (!artisan) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    const originalLength = artisan.portfolioImages.length;
    artisan.portfolioImages = artisan.portfolioImages.filter(img => img !== imageUrl);

    if (artisan.portfolioImages.length === originalLength) {
      throw new AppError('VALIDATION_ERROR', 'Image not found in portfolio.');
    }

    await artisan.save();

    res.json({
      success: true,
      message: 'Portfolio image deleted successfully',
      data: { portfolioImages: artisan.portfolioImages }
    });
  } catch (error) {
    next(error);
  }
};