const express = require('express');
const router = express.Router();
const artisanController = require('../controllers/artisanController');
const { authenticate: protect } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES (no auth needed)
// ==========================================

// Get all artisans (with filters)
router.get('/', artisanController.getArtisans);

// Search artisans — MUST come before /:id
router.get('/search', artisanController.searchArtisans);

// Get nearby artisans — MUST come before /:id
router.get('/nearby', artisanController.getNearbyArtisans);

// Get artisan reviews — MUST come before /:id
router.get('/:id/reviews', artisanController.getArtisanReviews);

// ==========================================
// PROTECTED ROUTES (auth required)
// ==========================================

// Get my artisan profile — MUST come before /:id
router.get('/me', protect, artisanController.getMyProfile);

// Update my profile
router.put('/me', protect, artisanController.updateProfile);

// Update availability
router.put('/me/availability', protect, artisanController.updateAvailability);

// Update bank details
router.put('/me/bank', protect, artisanController.updateBankDetails);

// Upload portfolio images
router.post('/me/portfolio', protect, artisanController.uploadPortfolioImages);

// Delete portfolio image
router.delete('/me/portfolio', protect, artisanController.deletePortfolioImage);

// Get single artisan public profile by ID — MUST come LAST
router.get('/:id', artisanController.getArtisanById);

module.exports = router;