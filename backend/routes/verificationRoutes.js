const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const verificationController = require('../controllers/verificationController');

// All routes protected
router.use(authenticate);

// Get current status
router.get('/status', verificationController.getVerificationStatus);

//Customer and Artisan identity verification endpoints
router.post('/identity', authorize('customer'), verificationController.verifyCustomerIdentity);
router.post('/identity', authorize('artisan'), verificationController.verifyArtisanIdentity);


// Tier verification endpoints
router.post('/tier', verificationController.getTierStatus);

// Individual verification endpoints
router.post('/nin', verificationController.verifyNIN);
router.post('/bvn', verificationController.verifyBVN);
router.post('/photo', uploadSingle('photo'), verificationController.verifyPhoto);
router.post('/cac', verificationController.verifyCAC);
router.post('/shop-location', verificationController.verifyShopLocation);
router.post('/confirm-shop-location', verificationController.confirmShopLocation);

// Check tier (for job controller use)
router.get('/check-job/:jobValue', async (req, res) => {
  const result = await verificationController.canAcceptJobValue(
    req.user._id, 
    parseInt(req.params.jobValue)
  );
  res.json(result);
});

module.exports = router;