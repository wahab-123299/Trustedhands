const mongoose = require('mongoose');
const { User, ArtisanProfile, Job, Wallet } = require('../models');
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

exports.getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const artisanProfile = await ArtisanProfile.findOne({ userId })
      .populate('userId', 'fullName email phone profileImage location isVerified')
      .populate('walletId');

    if (!artisanProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Artisan profile not found. Please complete your profile setup.'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        artisan: transformArtisan(artisanProfile)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all artisans with filters
exports.getArtisans = async (req, res, next) => {
  try {
    const {
      state,
      city,
      skills,
      availability,
      minRating,
      maxRate,
      experienceYears,
      page = 1,
      limit = 10,
      sortBy = 'averageRating'
    } = req.query;

    const query = {};

    if (availability) query['availability.status'] = availability;
    if (minRating) query.averageRating = { $gte: parseFloat(minRating) };
    if (maxRate) query['rate.amount'] = { $lte: parseFloat(maxRate) };
    if (experienceYears) query.experienceYears = experienceYears;

    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillsArray };
    }

    let sort = {};
    if (sortBy === 'rating') sort = { averageRating: -1 };
    else if (sortBy === 'price_low') sort = { 'rate.amount': 1 };
    else if (sortBy === 'price_high') sort = { 'rate.amount': -1 };
    else if (sortBy === 'experience') sort = { experienceYears: -1 };
    else sort = { averageRating: -1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let artisans = await ArtisanProfile.find(query)
      .populate({
        path: 'userId',
        model: 'User',
        select: 'fullName location profileImage isVerified phone isActive email',
        match: { isActive: true }
      })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    artisans = artisans.filter(a => a.userId !== null);

    if (state) {
      artisans = artisans.filter(a => 
        a.userId.location?.state?.toLowerCase() === state.toLowerCase()
      );
    }

    if (city) {
      artisans = artisans.filter(a => 
        a.userId.location?.city?.toLowerCase() === city.toLowerCase()
      );
    }

    const total = await ArtisanProfile.countDocuments(query);

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

// Search artisans by name or skill
exports.searchArtisans = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Search query is required.');
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    const skip = (parseInt(page) - 1) * parseInt(limit);

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

    const reviews = await Job.find({
      artisanId: id,
      status: 'completed',
      'review.rating': { $exists: true }
    })
      .select('review customerId completedAt')
      .populate('customerId', 'fullName profileImage')
      .sort({ completedAt: -1 })
      .limit(10);

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

// Get artisan reviews
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

// Update bank details (artisan only)
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

// ==========================================
// EXPORT ALL FUNCTIONS
// ==========================================
module.exports = {
  getMyProfile: exports.getMyProfile,
  getArtisans: exports.getArtisans,
  searchArtisans: exports.searchArtisans,
  getNearbyArtisans: exports.getNearbyArtisans,
  getArtisanById: exports.getArtisanById,
  getArtisanReviews: exports.getArtisanReviews,
  updateProfile: exports.updateProfile,
  updateAvailability: exports.updateAvailability,
  updateBankDetails: exports.updateBankDetails,
  uploadPortfolioImages: exports.uploadPortfolioImages,
  deletePortfolioImage: exports.deletePortfolioImage
};

// Debug: Verify all exports are defined
console.log('Artisan Controller Exports:', Object.keys(module.exports).map(k => `${k}: ${typeof module.exports[k]}`));