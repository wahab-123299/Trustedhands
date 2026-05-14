const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authen} = require('../middleware/authMiddleware');

router.post('/', authenticate, favoriteController.addFavorite);
router.get('/', authenticate, favoriteController.getMyFavorites);
router.get('/recommendations', authenticate, favoriteController.getRecommendations);
router.get('/check/:artisanId', authenticate, favoriteController.checkFavorite);
router.put('/:artisanId', authenticate, favoriteController.updateFavorite);
router.delete('/:artisanId', authenticate, favoriteController.removeFavorite);

module.exports = router;