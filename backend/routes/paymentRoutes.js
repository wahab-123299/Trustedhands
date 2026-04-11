const express = require('express');
const router = express.Router();
const { paymentController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public webhook route (secured by signature verification)
router.post('/webhook', paymentController.webhook);

// Public bank routes
router.get('/banks', paymentController.getBanks);
router.post('/verify-account', paymentController.verifyAccount);

// Protected payment routes
router.post('/initialize', authenticate, authorize('customer'), paymentController.initializePayment);
router.get('/verify/:reference', authenticate, paymentController.verifyPayment);
router.get('/history', authenticate, paymentController.getTransactionHistory);
router.get('/wallet', authenticate, authorize('artisan'), paymentController.getWallet);
router.post('/withdraw', authenticate, authorize('artisan'), paymentController.requestWithdrawal);

// ==========================================
// WALLET ROUTES (for frontend compatibility)
// ==========================================

// Wallet balance
router.get('/wallet/balance', authenticate, paymentController.getWallet);

// Withdraw from wallet
router.post('/wallet/withdraw', authenticate, paymentController.requestWithdrawal);

// Initialize deposit to wallet
router.post('/wallet/deposit/initialize', authenticate, paymentController.initializePayment);

// Get wallet transaction history
router.get('/wallet/transactions', authenticate, paymentController.getTransactionHistory);

module.exports = router;