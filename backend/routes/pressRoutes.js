const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const pressController = require('../controllers/pressController');

// Public routes
router.get('/', pressController.getAllArticles);
router.get('/featured', pressController.getFeaturedArticles);
router.get('/:slug', pressController.getArticleBySlug);

// Protected admin routes
router.post('/', authenticate, authorize('admin'), pressController.createArticle);
router.put('/:slug', authenticate, authorize('admin'), pressController.updateArticle);
router.delete('/:slug', authenticate, authorize('admin'), pressController.deleteArticle);

module.exports = router;