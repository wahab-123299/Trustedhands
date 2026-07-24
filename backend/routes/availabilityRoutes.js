const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// SPECIFIC ROUTES
// ==========================================
router.post('/set', protect, availabilityController.setAvailability);
router.post('/block', protect, availabilityController.blockDate);
router.post('/unblock', protect, availabilityController.unblockDate);

router.get('/patterns', protect, availabilityController.getRecurringPatterns);
router.post('/patterns', protect, availabilityController.createRecurringPattern);
router.delete('/patterns/:patternId', protect, availabilityController.deleteRecurringPattern);

// ==========================================
// PARAMETERIZED ROUTES
// ==========================================
router.get('/:artisanId/check', availabilityController.checkAvailability);
router.get('/:artisanId', availabilityController.getAvailability);

// ==========================================
// SERVICE FUNCTIONS WRAPPED AS ROUTES
// ==========================================
router.post('/book', protect, async (req, res, next) => {
  try {
    if (typeof availabilityController.bookSlot !== 'function') {
      throw new Error('bookSlot is not defined in controller');
    }
    const result = await availabilityController.bookSlot(
      req.user._id,
      req.body.date,
      req.body.startTime,
      req.body.endTime,
      req.body.jobId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/cancel', protect, async (req, res, next) => {
  try {
    if (typeof availabilityController.cancelBooking !== 'function') {
      throw new Error('cancelBooking is not defined in controller');
    }
    const result = await availabilityController.cancelBooking(
      req.user._id,
      req.body.date,
      req.body.jobId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
