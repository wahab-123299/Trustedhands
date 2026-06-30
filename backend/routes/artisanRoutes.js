const express = require('express');
const router = express.Router();
const artisanController = require('../controllers/artisanController');
const { authenticate: protect } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES (no auth needed)
// ==========================================

// Get all artisans (with filters)
router.get('/', artisanController.getArtisans);

// Search artisans
router.get('/search', artisanController.searchArtisans);

// Get nearby artisans
router.get('/nearby', artisanController.getNearbyArtisans);

// Get single artisan public profile by ID
router.get('/:id', artisanController.getArtisanById);

// Get artisan reviews
router.get('/:id/reviews', artisanController.getArtisanReviews);

// ==========================================
// PROTECTED ROUTES (auth required)
// ==========================================

// Get my artisan profile
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

module.exports = router;