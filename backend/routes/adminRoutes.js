const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/admin');

// All routes require authentication + admin role
router.use(protect, requireAdmin);

// Dashboard stats
router.get('/dashboard', adminController.getDashboardStats);

// Users
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/status', adminController.toggleUserStatus);

// Transactions
router.get('/transactions', adminController.getAllTransactions);

// Disputes
router.get('/disputes', adminController.getAllDisputes);
router.post('/disputes/:jobId/resolve', adminController.resolveDispute);

// Artisans
router.get('/artisans/top', adminController.getTopArtisans);
router.get('/artisans/:artisanId/analytics', adminController.getArtisanAnalytics);

// ✅ Artisan verifications
router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:id', adminController.verifyArtisan);

// ✅ All artisans list (must be LAST to avoid conflicting with /artisans/top and /artisans/:artisanId/analytics)
router.get('/artisans', adminController.getAllArtisans);

module.exports = router;