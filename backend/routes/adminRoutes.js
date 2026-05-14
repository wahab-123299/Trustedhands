const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/admin');

router.get('/dashboard', protect, requireAdmin, adminController.getDashboardStats);
router.get('/users', protect, requireAdmin, adminController.getAllUsers);
router.patch('/users/:userId/status', protect, requireAdmin, adminController.toggleUserStatus);
router.get('/transactions', protect, requireAdmin, adminController.getAllTransactions);
router.get('/disputes', protect, requireAdmin, adminController.getAllDisputes);
router.post('/disputes/:jobId/resolve', protect, requireAdmin, adminController.resolveDispute);
router.get('/artisans/top', protect, requireAdmin, adminController.getTopArtisans);
router.get('/artisans/:artisanId/analytics', protect, requireAdmin, adminController.getArtisanAnalytics);

module.exports = router;