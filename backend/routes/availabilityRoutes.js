const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { authenticate } = require('../middleware/auth');

router.post('/set', authenticate, availabilityController.setAvailability);
router.post('/block', authenticate, availabilityController.blockDate);
router.post('/unblock', authenticate, availabilityController.unblockDate);
router.get('/patterns', authenticate, availabilityController.getRecurringPatterns);
router.post('/patterns', authenticate, availabilityController.createRecurringPattern);
router.delete('/patterns/:patternId', authenticate, availabilityController.deleteRecurringPattern);
router.get('/:artisanId', availabilityController.getAvailability);
router.get('/:artisanId/check', availabilityController.checkAvailability);

module.exports = router;