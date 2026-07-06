// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { paymentController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES (no auth required)
// ==========================================

// Paystack webhook (secured by signature verification, NOT JWT)
router.post('/webhook', paymentController.webhook);

// Get list of banks
router.get('/banks', paymentController.getBanks);

// Verify bank account number
router.post('/verify-account', paymentController.verifyAccount);

// ==========================================
// PROTECTED PAYMENT ROUTES
// ==========================================

// Initialize payment for a JOB (customer only)
router.post('/initialize', authenticate, authorize('customer'), paymentController.initializePayment);

// Verify payment by reference (any authenticated user)
router.get('/verify/:reference', authenticate, paymentController.verifyPayment);

// Release escrow payment (customer confirms job completion)
router.post('/release/:jobId', authenticate, authorize('customer'), paymentController.releasePayment);

// Get transaction history (any authenticated user)
router.get('/history', authenticate, paymentController.getTransactionHistory);

// ==========================================
// WALLET ROUTES (Artisan only)
// ==========================================

// Get wallet details & balance
router.get('/wallet', authenticate, authorize('artisan'), paymentController.getWallet);

// Request withdrawal from wallet (artisan only)
router.post('/withdraw', authenticate, authorize('artisan'), paymentController.requestWithdrawal);

// ==========================================
// FRONTEND COMPATIBILITY ALIASES
// ==========================================

// Alias: /wallet/balance → /wallet
router.get('/wallet/balance', authenticate, authorize('artisan'), paymentController.getWallet);

// Alias: /wallet/withdraw → /withdraw
router.post('/wallet/withdraw', authenticate, authorize('artisan'), paymentController.requestWithdrawal);

// Alias: /wallet/transactions → /history
router.get('/wallet/transactions', authenticate, paymentController.getTransactionHistory);

// ==========================================
// WALLET DEPOSIT (Artisan only - separate from job payment)
// ==========================================

// FIXED: Reuse initializePayment for wallet deposits (pass isWalletDeposit flag)
// If you need a separate wallet deposit handler later, create initializeWalletDeposit in the controller
router.post('/wallet/deposit/initialize', authenticate, authorize('artisan'), paymentController.initializePayment);

module.exports = router;