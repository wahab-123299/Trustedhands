const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');

// ✅ SPECIFIC ROUTES FIRST
router.post('/set', protect, availabilityController.setAvailability);
router.post('/block', protect, availabilityController.blockDate);
router.post('/unblock', protect, availabilityController.unblockDate);
router.get('/patterns', protect, availabilityController.getRecurringPatterns);
router.post('/patterns', protect, availabilityController.createRecurringPattern);
router.delete('/patterns/:patternId', protect, availabilityController.deleteRecurringPattern);

// ✅ PARAMETERIZED ROUTES LAST (these catch anything else)
router.get('/:artisanId', availabilityController.getAvailability);
router.get('/:artisanId/check', availabilityController.checkAvailability);

module.exports = router;