const Favorite = require('../models/Favorite');
const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');
const { AppError } = require('../utils/errorHandler');


// ==========================================
// ADD TO FAVORITES
// ==========================================
exports.addFavorite = async (req, res, next) => {
  try {
    const { artisanId, note, tags } = req.body;
    const customerId = req.user._id;

    if (!artisanId) {
      throw new AppError('VALIDATION_ERROR', 'Artisan ID is required');
    }

    // Verify artisan exists
    const artisan = await User.findOne({
      _id: artisanId,
      role: 'artisan',
      isActive: true
    });

    if (!artisan) {
      throw new AppError('NOT_FOUND', 'Artisan not found');
    }

    // Check if already favorited
    const existing = await Favorite.findOne({ customerId, artisanId });
    if (existing) {
      return res.json({
        success: true,
        message: 'Artisan is already in your favorites',
        data: { favorite: existing }
      });
    }

    const favorite = await Favorite.create({
      customerId,
      artisanId,
      note: note?.trim(),
      tags: tags?.map(t => t.trim().toLowerCase()) || [],
      hiredBefore: false,
      hireCount: 0
    });

    await favorite.populate('artisanId', 'fullName profileImage');

    res.status(201).json({
      success: true,
      message: 'Added to favorites',
      data: { favorite }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_FAVORITED', message: 'Artisan is already in favorites' }
      });
    }
    next(error);
  }
};

// ==========================================
// REMOVE FROM FAVORITES
// ==========================================
exports.removeFavorite = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const customerId = req.user._id;

    const result = await Favorite.findOneAndDelete({ customerId, artisanId });

    if (!result) {
      throw new AppError('NOT_FOUND', 'Favorite not found');
    }

    res.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET MY FAVORITES
// ==========================================
exports.getMyFavorites = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tag, hiredBefore, search } = req.query;
    const customerId = req.user._id;

    const query = { customerId };

    if (tag) {
      query.tags = { $in: [tag.toLowerCase()] };
    }

    if (hiredBefore === 'true') {
      query.hiredBefore = true;
    } else if (hiredBefore === 'false') {
      query.hiredBefore = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let favoritesQuery = Favorite.find(query)
      .populate({
        path: 'artisanId',
        select: 'fullName profileImage email phone',
        populate: {
          path: 'artisanProfile',
          select: 'profession skills rate averageRating location'
        }
      })
      .sort({ lastInteractedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const favorites = await favoritesQuery.lean();

    // Filter by search if provided
    let filtered = favorites;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = favorites.filter(f => 
        f.artisanId?.fullName?.toLowerCase().includes(searchLower) ||
        f.artisanId?.artisanProfile?.profession?.toLowerCase().includes(searchLower) ||
        f.artisanId?.artisanProfile?.skills?.some(s => s.toLowerCase().includes(searchLower)) ||
        f.tags?.some(t => t.toLowerCase().includes(searchLower)) ||
        f.note?.toLowerCase().includes(searchLower)
      );
    }

    const total = await Favorite.countDocuments(query);

    // Get unique tags for this customer
    const tagAggregation = await Favorite.aggregate([
      { $match: { customerId: customerId } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        favorites: filtered,
        tags: tagAggregation.map(t => ({ name: t._id, count: t.count })),
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

// ==========================================
// UPDATE FAVORITE (note, tags, personal rating)
// ==========================================
exports.updateFavorite = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { note, tags, personalRating } = req.body;
    const customerId = req.user._id;

    const update = {};
    if (note !== undefined) update.note = note?.trim();
    if (tags !== undefined) update.tags = tags?.map(t => t.trim().toLowerCase()) || [];
    if (personalRating !== undefined) update.personalRating = personalRating;
    update.lastInteractedAt = new Date();

    const favorite = await Favorite.findOneAndUpdate(
      { customerId, artisanId },
      { $set: update },
      { new: true }
    ).populate('artisanId', 'fullName profileImage');

    if (!favorite) {
      throw new AppError('NOT_FOUND', 'Favorite not found');
    }

    res.json({
      success: true,
      message: 'Favorite updated',
      data: { favorite }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CHECK IF ARTISAN IS FAVORITED
// ==========================================
exports.checkFavorite = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const customerId = req.user._id;

    const favorite = await Favorite.findOne({ customerId, artisanId })
      .select('note tags hiredBefore hireCount personalRating createdAt');

    res.json({
      success: true,
      data: {
        isFavorited: !!favorite,
        favorite: favorite || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET RECOMMENDED ARTISANS BASED ON FAVORITES
// ==========================================
exports.getRecommendations = async (req, res, next) => {
  try {
    const customerId = req.user._id;
    const { limit = 10 } = req.query;

    // Get customer's favorite artisans' skills and professions
    const favorites = await Favorite.find({ customerId })
      .populate({
        path: 'artisanId',
        select: 'artisanProfile',
        populate: {
          path: 'artisanProfile',
          select: 'skills profession location.state location.city'
        }
      });

    if (favorites.length === 0) {
      return res.json({
        success: true,
        data: {
          recommendations: [],
          message: 'Add artisans to favorites to get recommendations'
        }
      });
    }

    // Extract preferred skills and professions
    const preferredSkills = new Set();
    const preferredProfessions = new Set();
    const preferredLocations = new Set();

    favorites.forEach(f => {
      const profile = f.artisanId?.artisanProfile;
      if (profile) {
        profile.skills?.forEach(s => preferredSkills.add(s));
        if (profile.profession) preferredProfessions.add(profile.profession);
        if (profile.location?.state) preferredLocations.add(profile.location.state);
      }
    });

    // Find similar artisans not yet favorited
    const favoriteArtisanIds = favorites.map(f => f.artisanId._id.toString());

    const recommendations = await ArtisanProfile.find({
      userId: { $nin: favoriteArtisanIds },
      $or: [
        { skills: { $in: Array.from(preferredSkills) } },
        { profession: { $in: Array.from(preferredProfessions) } }
      ],
      'availability.status': 'available'
    })
    .populate('userId', 'fullName profileImage')
    .limit(parseInt(limit))
    .lean();

    // Sort by relevance (more matching skills = higher)
    const scored = recommendations.map(artisan => {
      let score = 0;
      const skills = new Set(artisan.skills || []);
      const profession = artisan.profession;

      preferredSkills.forEach(s => {
        if (skills.has(s)) score += 2;
      });
      if (preferredProfessions.has(profession)) score += 3;
      if (preferredLocations.has(artisan.location?.state)) score += 1;

      return { ...artisan, relevanceScore: score };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.json({
      success: true,
      data: {
        recommendations: scored,
        basedOn: {
          skills: Array.from(preferredSkills),
          professions: Array.from(preferredProfessions)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// STEP 3: Create routes/favoriteRoutes.js
// ==========================================
/*
const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, favoriteController.addFavorite);
router.get('/', authenticate, favoriteController.getMyFavorites);
router.get('/recommendations', authenticate, favoriteController.getRecommendations);
router.get('/check/:artisanId', authenticate, favoriteController.checkFavorite);
router.put('/:artisanId', authenticate, favoriteController.updateFavorite);
router.delete('/:artisanId', authenticate, favoriteController.removeFavorite);

module.exports = router;
*/

// ==========================================
// STEP 4: Add to app.js
// ==========================================
/*
// Add this line with other routes:
app.use('/api/favorites', require('./routes/favoriteRoutes'));
*/

// ==========================================
// STEP 5: Add to models/index.js
// ==========================================
/*
const Favorite = require('./Favorite');

module.exports = {
  // ... existing exports ...
  Favorite
};
*/

// ==========================================
// STEP 6: Auto-update hiredBefore when job completes
// In jobController.js completeJob(), AFTER job is completed:
// ==========================================
/*
// Update hiredBefore in favorites
try {
  const Favorite = require('../models/Favorite');
  await Favorite.findOneAndUpdate(
    { customerId: job.customerId, artisanId: job.artisanId },
    {
      $set: {
        hiredBefore: true,
        lastInteractedAt: new Date()
      },
      $inc: { hireCount: 1 }
    },
    { upsert: true }
  );
} catch (e) {
  console.error('[completeJob] Favorite update failed:', e.message);
}
*/

module.exports = {

  addFavorite: exports.addFavorite,
  removeFavorite: exports.removeFavorite,
  getMyFavorites: exports.getMyFavorites,
  updateFavorite: exports.updateFavorite,
  checkFavorite: exports.checkFavorite,
  getRecommendations: exports.getRecommendations
};