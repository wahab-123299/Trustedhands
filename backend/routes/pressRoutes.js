// backend/routes/pressRoutes.js
const express = require('express');
const router = express.Router();
const pressController = require('../controllers/pressController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', pressController.getAllArticles);
router.get('/featured', pressController.getFeaturedArticles);
router.get('/:slug', pressController.getArticleBySlug);

// Admin routes (protected)
router.post('/', authenticate, authorize('admin'), pressController.createArticle);
router.get('/admin/all', authenticate, authorize('admin'), pressController.getAllArticlesAdmin);
router.put('/:id', authenticate, authorize('admin'), pressController.updateArticle);
router.delete('/:id', authenticate, authorize('admin'), pressController.deleteArticle);

module.exports = router;