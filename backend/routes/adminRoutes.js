const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/admin');

router.get('/dashboard', authenticate, requireAdmin, adminController.getDashboardStats);
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);
router.patch('/users/:userId/status', authenticate, requireAdmin, adminController.toggleUserStatus);
router.get('/transactions', authenticate, requireAdmin, adminController.getAllTransactions);
router.get('/disputes', authenticate, requireAdmin, adminController.getAllDisputes);
router.post('/disputes/:jobId/resolve', authenticate, requireAdmin, adminController.resolveDispute);
router.get('/artisans/top', authenticate, requireAdmin, adminController.getTopArtisans);
router.get('/artisans/:artisanId/analytics', authenticate, adminController.getArtisanAnalytics);

module.exports = router;