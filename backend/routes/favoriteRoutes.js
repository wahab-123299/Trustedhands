const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { protect} = require('../middleware/authMiddleware');

router.post('/', protect, favoriteController.addFavorite);
router.get('/', protect, favoriteController.getMyFavorites);
router.get('/recommendations', protect, favoriteController.getRecommendations);
router.get('/check/:artisanId', protect, favoriteController.checkFavorite);
router.put('/:artisanId', protect, favoriteController.updateFavorite);
router.delete('/:artisanId', protect, favoriteController.removeFavorite);

module.exports = router;