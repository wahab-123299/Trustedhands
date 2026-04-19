const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Job = require('../models/Job');
const { AppError } = require('../utils/errorHandler');
const axios = require('axios');

// ==========================================
// TIER CONFIGURATION
// ==========================================

const TIER_CONFIG = {
  bronze: {
    maxJobValue: 10000,
    requiresId: false,
    escrowSplits: [100],
  },
  silver: {
    maxJobValue: 50000,
    requiresId: true,
    escrowSplits: [50, 50],
  },
  gold: {
    maxJobValue: Infinity,
    requiresId: true,
    escrowSplits: [25, 25, 25, 25],
  },
};

// ==========================================
// MOCK MODE (for testing without real APIs)
// ==========================================

const MOCK_VERIFICATION = process.env.MOCK_VERIFICATION === 'true';

// ==========================================
// CUSTOMER IDENTITY VERIFICATION
// ==========================================

exports.verifyCustomerIdentity = async (req, res, next) => {
  try {
    const { nin, bvn, idType, tier: requestedTier } = req.body;
    const userId = req.user._id;

    // Validate current user can upgrade to requested tier
    const user = await User.findById(userId);
    const currentTier = user.verificationTier || 'bronze';
    
    // Determine target tier
    let targetTier = requestedTier;
    if (!targetTier || TIER_CONFIG[targetTier].maxJobValue <= TIER_CONFIG[currentTier].maxJobValue) {
      targetTier = currentTier === 'bronze' ? 'silver' : 'gold';
    }

    // Validate NIN/BVN format
    if (!/^\d{11}$/.test(nin)) {
      throw new AppError('VALIDATION_ERROR', 'NIN must be 11 digits');
    }
    if (!/^\d{11}$/.test(bvn)) {
      throw new AppError('VALIDATION_ERROR', 'BVN must be 11 digits');
    }

    let verificationResult;

    if (MOCK_VERIFICATION) {
      // Mock: Simulate 2s delay, always succeed
      await new Promise(r => setTimeout(r, 2000));
      verificationResult = {
        verified: true,
        reference: `MOCK-${Date.now()}`,
        provider: 'verifyme',
        timestamp: new Date().toISOString(),
      };
    } else {
      // Real VerifyMe/YouVerify API integration
      verificationResult = await verifyWithVerifyMe(nin, bvn);
    }

    if (!verificationResult.verified) {
      throw new AppError('VERIFICATION_FAILED', 'Identity verification failed. Please check your NIN/BVN.');
    }

    // Update user with new tier
    user.verificationTier = targetTier;
    user.verification = {
      status: 'verified',
      reference: verificationResult.reference,
      provider: verificationResult.provider,
      verifiedAt: new Date(),
      method: 'nin-bvn',
      // DO NOT store raw NIN/BVN - only verification reference
    };

    await user.save();

    res.json({
      success: true,
      message: `Successfully upgraded to ${targetTier} tier`,
      data: {
        tier: targetTier,
        reference: verificationResult.reference,
        maxJobValue: TIER_CONFIG[targetTier].maxJobValue,
        escrowSplits: TIER_CONFIG[targetTier].escrowSplits,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ARTISAN VERIFICATION
// ==========================================

exports.verifyArtisan = async (req, res, next) => {
  try {
    const {
      personal, // { nin, bvn, idType }
      business, // { hasCAC, cacNumber, businessName, shopGPS, businessAddress }
      skills, // { primarySkill, yearsExperience, portfolioCount }
      tier: requestedTier,
    } = req.body;

    const userId = req.user._id;
    const user = await User.findById(userId);
    const currentTier = user.verificationTier || 'bronze';

    let targetTier = requestedTier;
    if (!targetTier || TIER_CONFIG[targetTier].maxJobValue <= TIER_CONFIG[currentTier].maxJobValue) {
      targetTier = currentTier === 'bronze' ? 'silver' : 'gold';
    }

    // Step 1: Verify personal identity
    let personalVerified = false;
    let personalReference = null;

    if (MOCK_VERIFICATION) {
      await new Promise(r => setTimeout(r, 1500));
      personalVerified = true;
      personalReference = `MOCK-PERSONAL-${Date.now()}`;
    } else {
      const personalResult = await verifyWithVerifyMe(personal.nin, personal.bvn);
      personalVerified = personalResult.verified;
      personalReference = personalResult.reference;
    }

    if (!personalVerified) {
      throw new AppError('VERIFICATION_FAILED', 'Personal identity verification failed.');
    }

    // Step 2: Verify business
    let businessVerified = false;
    let businessReference = null;

    if (business.hasCAC && business.cacNumber) {
      // CAC verification
      if (MOCK_VERIFICATION) {
        await new Promise(r => setTimeout(r, 1000));
        businessVerified = true;
        businessReference = `MOCK-CAC-${business.cacNumber}`;
      } else {
        const cacResult = await verifyCAC(business.cacNumber);
        businessVerified = cacResult.verified;
        businessReference = cacResult.reference;
      }
    } else if (business.shopGPS) {
      // GPS location verification (individual artisan)
      businessVerified = true;
      businessReference = `GPS-${business.shopGPS.lat.toFixed(4)}-${business.shopGPS.lng.toFixed(4)}`;
    }

    if (!businessVerified) {
      throw new AppError('VERIFICATION_FAILED', 'Business verification failed. Please provide valid CAC or location.');
    }

    // Update user
    user.verificationTier = targetTier;
    user.verification = {
      status: 'verified',
      reference: `${personalReference}-${businessReference}`,
      provider: 'verifyme-cac',
      verifiedAt: new Date(),
      method: business.hasCAC ? 'cac-registered' : 'individual-gps',
      details: {
        personalVerified: true,
        businessType: business.hasCAC ? 'registered' : 'individual',
        cacNumber: business.hasCAC ? business.cacNumber : null,
        shopLocation: !business.hasCAC ? business.shopGPS : null,
        primarySkill: skills.primarySkill,
        yearsExperience: skills.yearsExperience,
      },
    };

    // Update artisan profile
    const ArtisanProfile = require('../models/ArtisanProfile');
    await ArtisanProfile.findOneAndUpdate(
      { userId },
      {
        isVerified: true,
        verificationTier: targetTier,
        canApplyForHighValueJobs: targetTier !== 'bronze',
        skills: skills.primarySkill ? [skills.primarySkill] : [],
        experienceYears: skills.yearsExperience,
        location: {
          address: business.businessAddress,
          coordinates: business.shopGPS,
        },
      },
      { upsert: true }
    );

    await user.save();

    res.json({
      success: true,
      message: `Artisan verified: ${targetTier} tier`,
      data: {
        tier: targetTier,
        reference: user.verification.reference,
        maxJobValue: TIER_CONFIG[targetTier].maxJobValue,
        canApplyForHighValueJobs: targetTier !== 'bronze',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET USER TIER STATUS
// ==========================================

exports.getTierStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('verificationTier verification role');
    
    const tier = user.verificationTier || 'bronze';
    const config = TIER_CONFIG[tier];

    res.json({
      success: true,
      data: {
        currentTier: tier,
        config,
        nextTier: tier === 'bronze' ? 'silver' : tier === 'silver' ? 'gold' : null,
        isVerified: user.verification?.status === 'verified',
        verificationDate: user.verification?.verifiedAt,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// HELPER: Real VerifyMe Integration
// ==========================================

async function verifyWithVerifyMe(nin, bvn) {
  try {
    const response = await axios.post(
      'https://api.youverify.co/v2/api/identity/ng/nin',
      {
        id: nin,
        // YouVerify uses NIN, BVN optional additional check
        metadata: {
          bvn: bvn, // For cross-validation only
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.YOUVERIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    // YouVerify returns verification status
    if (response.data?.data?.verified) {
      return {
        verified: true,
        reference: response.data.data.reference,
        provider: 'youverify',
        // Only store reference, not raw data
      };
    }

    return { verified: false };
  } catch (error) {
    console.error('YouVerify error:', error.response?.data || error.message);
    throw new AppError('VERIFICATION_SERVICE_ERROR', 'Identity verification service temporarily unavailable.');
  }
}

// ==========================================
// HELPER: CAC Verification (mock/real)
// ==========================================

async function verifyCAC(cacNumber) {
  if (MOCK_VERIFICATION) {
    // Mock CAC check - in production, integrate with CAC API or manual review
    return {
      verified: true,
      reference: `CAC-${cacNumber}`,
      status: 'active',
    };
  }

  // Real CAC verification would go here
  // Currently no public CAC API, typically manual review or third-party service
  throw new AppError('NOT_IMPLEMENTED', 'CAC verification requires manual review in current version.');
}

// ==========================================
// ROUTES
// ==========================================

router.post('/customer/identity', authenticate, authorize('customer'), exports.verifyCustomerIdentity);
router.post('/artisan/verify', authenticate, authorize('artisan'), exports.verifyArtisan);
router.get('/tier', authenticate, exports.getTierStatus);

module.exports = router;