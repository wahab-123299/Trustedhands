const express = require('express');
const router = express.Router();
const { artisanController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { uploadMultiple } = require('../middleware/uploadMiddleware');

// Public routes
router.get('/', artisanController.getArtisans);
router.get('/search', artisanController.searchArtisans);
router.get('/nearby', artisanController.getNearbyArtisans);
router.get('/:id', artisanController.getArtisanById);
router.get('/:id/reviews', artisanController.getArtisanReviews);

// Protected routes - Artisan only
router.put('/profile', authenticate, authorize('artisan'), artisanController.updateProfile);
router.put('/availability', authenticate, authorize('artisan'), artisanController.updateAvailability);
router.put('/bank-details', authenticate, authorize('artisan'), artisanController.updateBankDetails);
router.post('/portfolio-images', authenticate, authorize('artisan'), uploadMultiple('images', 6), artisanController.uploadPortfolioImages);
router.delete('/portfolio-image', authenticate, authorize('artisan'), artisanController.deletePortfolioImage);

module.exports = router;
