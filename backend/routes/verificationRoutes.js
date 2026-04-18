const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const verificationController = require('../controllers/verificationController');

// All routes protected
router.use(authenticate);

// Get current status
router.get('/status', verificationController.getVerificationStatus);

// Tier verification endpoints
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