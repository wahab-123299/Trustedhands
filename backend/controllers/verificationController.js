const { User, ArtisanProfile } = require('../models');
const { AppError } = require('../utils/errorHandler');

// ==========================================
// TIER CONFIGURATION
// ==========================================

const TIER_LIMITS = {
  bronze: { min: 0, max: 20000 },
  silver: { min: 20000, max: 200000 },
  gold: { min: 200000, max: 500000 },
  platinum: { min: 500000, max: Infinity }
};

const TIER_REQUIREMENTS = {
  bronze: [], // No requirements - default tier
  silver: ['nin_verified', 'bvn_verified', 'photo_verified', 'min_jobs_5', 'min_rating_4'],
  gold: ['cac_verified', 'shop_location_verified', 'video_interview', 'min_jobs_20', 'min_rating_4.5'],
  platinum: ['site_visit', 'insurance_bond', 'min_jobs_50', 'min_rating_4.8']
};

// ==========================================
// CHECK USER TIER (New function - doesn't affect existing code)
// ==========================================

exports.checkUserTier = async (userId) => {
  const user = await User.findById(userId);
  const profile = await ArtisanProfile.findOne({ userId });
  
  if (!user || user.role !== 'artisan') {
    return { tier: 'customer', canAcceptJob: true, maxJobValue: Infinity };
  }

  const checks = {
    nin_verified: profile?.verificationStatus?.nin?.verified || false,
    bvn_verified: profile?.verificationStatus?.bvn?.verified || false,
    photo_verified: profile?.verificationStatus?.photo?.verified || false,
    cac_verified: profile?.verificationStatus?.cac?.verified || false,
    shop_location_verified: profile?.verificationStatus?.shopLocation?.verified || false,
    video_interview: profile?.verificationStatus?.videoInterview?.passed || false,
    min_jobs_5: (profile?.totalJobsCompleted || 0) >= 5,
    min_jobs_20: (profile?.totalJobsCompleted || 0) >= 20,
    min_jobs_50: (profile?.totalJobsCompleted || 0) >= 50,
    min_rating_4: (profile?.rating || 0) >= 4.0,
    min_rating_4_5: (profile?.rating || 0) >= 4.5,
    min_rating_4_8: (profile?.rating || 0) >= 4.8,
    site_visit: profile?.verificationStatus?.siteVisit?.passed || false,
    insurance_bond: profile?.verificationStatus?.insurance?.active || false
  };

  // Determine tier
  let currentTier = 'bronze';
  if (TIER_REQUIREMENTS.platinum.every(req => checks[req])) currentTier = 'platinum';
  else if (TIER_REQUIREMENTS.gold.every(req => checks[req])) currentTier = 'gold';
  else if (TIER_REQUIREMENTS.silver.every(req => checks[req])) currentTier = 'silver';

  return {
    tier: currentTier,
    maxJobValue: TIER_LIMITS[currentTier].max,
    checks,
    missingRequirements: TIER_REQUIREMENTS[currentTier].filter(req => !checks[req])
  };
};

// ==========================================
// CHECK IF CAN ACCEPT JOB (Standalone - use in job controller)
// ==========================================

exports.canAcceptJobValue = async (userId, jobValue) => {
  const { tier, maxJobValue, missingRequirements } = await exports.checkUserTier(userId);
  
  if (jobValue > maxJobValue) {
    return {
      allowed: false,
      reason: `Your ${tier} tier allows jobs up to ₦${maxJobValue.toLocaleString()}`,
      requiredTier: Object.keys(TIER_LIMITS).find(key => TIER_LIMITS[key].max >= jobValue),
      missingRequirements
    };
  }
  
  return { allowed: true, tier, maxJobValue };
};

// ==========================================
// NIN VERIFICATION (New standalone endpoint)
// ==========================================

exports.verifyNIN = async (req, res, next) => {
  try {
    const { nin } = req.body;
    const userId = req.user._id;

    // Validate NIN format (11 digits)
    if (!/^\d{11}$/.test(nin)) {
      throw new AppError('VALIDATION_ERROR', 'NIN must be 11 digits');
    }

    // Call YouVerify API (placeholder - replace with actual API)
    const verificationResult = await callYouVerifyAPI('nin', nin, userId);
    
    if (!verificationResult.verified) {
      throw new AppError('VERIFICATION_FAILED', 'NIN verification failed. Please check and try again.');
    }

    // Update profile
    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'verificationStatus.nin': {
            verified: true,
            verifiedAt: new Date(),
            reference: verificationResult.reference,
            // DON'T store raw NIN
            maskedNIN: nin.slice(-4).padStart(11, '*')
          }
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'NIN verified successfully',
      tier: (await exports.checkUserTier(userId)).tier
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BVN VERIFICATION (New standalone endpoint)
// ==========================================

exports.verifyBVN = async (req, res, next) => {
  try {
    const { bvn } = req.body;
    const userId = req.user._id;

    // Validate BVN format (11 digits)
    if (!/^\d{11}$/.test(bvn)) {
      throw new AppError('VALIDATION_ERROR', 'BVN must be 11 digits');
    }

    // Call YouVerify API
    const verificationResult = await callYouVerifyAPI('bvn', bvn, userId);
    
    if (!verificationResult.verified) {
      throw new AppError('VERIFICATION_FAILED', 'BVN verification failed');
    }

    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'verificationStatus.bvn': {
            verified: true,
            verifiedAt: new Date(),
            reference: verificationResult.reference,
            maskedBVN: bvn.slice(-4).padStart(11, '*')
          }
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'BVN verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PHOTO VERIFICATION (Liveness check)
// ==========================================

exports.verifyPhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // In production: Use Smile Identity or YouVerify for liveness
    // For now: Manual admin approval workflow
    
    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'verificationStatus.photo': {
            verified: false, // Pending admin review
            uploadedAt: new Date(),
            photoUrl: req.file?.path, // From multer upload
            status: 'pending_review'
          }
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Photo uploaded and pending verification. This usually takes 24 hours.'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CAC VERIFICATION (For organizations)
// ==========================================

exports.verifyCAC = async (req, res, next) => {
  try {
    const { cacNumber, companyName } = req.body;
    const userId = req.user._id;

    // Call CAC API (placeholder)
    const verificationResult = await callCACAPI(cacNumber, companyName);
    
    if (!verificationResult.verified) {
      throw new AppError('VERIFICATION_FAILED', 'CAC verification failed');
    }

    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'verificationStatus.cac': {
            verified: true,
            verifiedAt: new Date(),
            cacNumber: cacNumber, // Store as it's public info
            companyName: verificationResult.companyName,
            registrationDate: verificationResult.registrationDate
          }
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'CAC verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SHOP LOCATION VERIFICATION (GPS)
// ==========================================

exports.verifyShopLocation = async (req, res, next) => {
  try {
    const { lat, lng, address } = req.body;
    const userId = req.user._id;

    // Store location
    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          shopLocation: {
            address,
            coordinates: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            verified: false, // Pending GPS check
            submittedAt: new Date()
          }
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Shop location submitted. Please visit your shop and verify via GPS.'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CONFIRM SHOP LOCATION (GPS check)
// ==========================================

exports.confirmShopLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const userId = req.user._id;

    const profile = await ArtisanProfile.findOne({ userId });
    
    if (!profile?.shopLocation?.coordinates) {
      throw new AppError('NOT_FOUND', 'Shop location not submitted yet');
    }

    // Calculate distance (Haversine formula)
    const distance = calculateDistance(
      lat,
      lng,
      profile.shopLocation.coordinates.coordinates[1], // lat
      profile.shopLocation.coordinates.coordinates[0]  // lng
    );

    if (distance > 100) { // 100 meters tolerance
      throw new AppError('VERIFICATION_FAILED', `You are ${Math.round(distance)}m away from registered location. Please be at your shop.`);
    }

    // Update as verified
    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'shopLocation.verified': true,
          'shopLocation.verifiedAt': new Date(),
          'verificationStatus.shopLocation': {
            verified: true,
            verifiedAt: new Date()
          }
        }
      }
    );

    res.json({
      success: true,
      message: 'Shop location verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET VERIFICATION STATUS (For frontend)
// ==========================================

exports.getVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const tierInfo = await exports.checkUserTier(userId);
    const profile = await ArtisanProfile.findOne({ userId })
      .select('verificationStatus shopLocation');

    res.json({
      success: true,
      data: {
        currentTier: tierInfo.tier,
        maxJobValue: tierInfo.maxJobValue,
        checks: tierInfo.checks,
        missingRequirements: tierInfo.missingRequirements,
        details: profile?.verificationStatus || {}
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Placeholder for YouVerify API call
async function callYouVerifyAPI(type, number, userId) {
  // In production, implement actual API call:
  /*
  const response = await fetch('https://api.youverify.co/v1/identity/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.YOUVERIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type,
      number,
      metadata: { userId }
    })
  });
  return await response.json();
  */
  
  // Mock response for development
  return {
    verified: true,
    reference: `YV-${Date.now()}`,
    fullName: 'Test User',
    // Don't return sensitive data
  };
}

// Placeholder for CAC API
async function callCACAPI(cacNumber, companyName) {
  // Implement actual CAC API integration
  return {
    verified: true,
    companyName: companyName,
    registrationDate: new Date()
  };
}

// Haversine formula for GPS distance
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// ==========================================
// MIDDLEWARE: Check tier before job acceptance
// ==========================================

exports.requireTierForJob = async (req, res, next) => {
  try {
    const { jobValue } = req.body; // Or from job lookup
    const userId = req.user._id;

    const check = await exports.canAcceptJobValue(userId, jobValue || 0);
    
    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'TIER_INSUFFICIENT',
          message: check.reason,
          requiredTier: check.requiredTier,
          missingRequirements: check.missingRequirements,
          upgradeUrl: '/verification'
        }
      });
    }

    // Attach tier info to request for later use
    req.userTier = check.tier;
    next();
  } catch (error) {
    next(error);
  }
};