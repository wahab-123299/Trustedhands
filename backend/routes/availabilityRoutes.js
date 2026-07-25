const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/set', authenticate, availabilityController.setAvailability);
router.post('/block', authenticate, availabilityController.blockDate);
router.post('/unblock', authenticate, availabilityController.unblockDate);

router.get('/patterns', authenticate, availabilityController.getRecurringPatterns);
router.post('/patterns', authenticate, availabilityController.createRecurringPattern);
router.delete('/patterns/:patternId', authenticate, availabilityController.deleteRecurringPattern);

router.get('/:artisanId/check', availabilityController.checkAvailability);
router.get('/:artisanId', availabilityController.getAvailability);

router.post('/book', authenticate, async (req, res, next) => {
  try {
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

router.post('/cancel', authenticate, async (req, res, next) => {
  try {
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