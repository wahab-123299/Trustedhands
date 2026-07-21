const express = require('express');
const router = express.Router();
const {
  setAvailability,
  getAvailability,
  blockDate,
  unblockDate,
  createRecurringPattern,
  getRecurringPatterns,
  deleteRecurringPattern,
  checkAvailability,
  bookSlot,
  cancelBooking
} = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// SPECIFIC ROUTES
// ==========================================
router.post('/set', protect, setAvailability);
router.post('/block', protect, blockDate);
router.post('/unblock', protect, unblockDate);

router.get('/patterns', protect, getRecurringPatterns);
router.post('/patterns', protect, createRecurringPattern);
router.delete('/patterns/:patternId', protect, deleteRecurringPattern);

// ==========================================
// PARAMETERIZED ROUTES
// ==========================================
router.get('/:artisanId/check', checkAvailability);
router.get('/:artisanId', getAvailability);

// ==========================================
// SERVICE FUNCTIONS WRAPPED AS ROUTES
// ==========================================
router.post('/book', protect, async (req, res, next) => {
  try {
    const result = await bookSlot(
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
    const result = await cancelBooking(
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
