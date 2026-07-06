// backend/routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { protect } = require('../middleware/authMiddleware');

// Debug: verify all expected handlers exist
const expectedHandlers = [
  'setAvailability',
  'getAvailability',
  'blockDate',
  'unblockDate',
  'createRecurringPattern',
  'getRecurringPatterns',
  'deleteRecurringPattern',
  'checkAvailability',
  'bookSlot',
  'cancelBooking'
];

console.log('[availabilityRoutes] Loaded controller functions:');
for (const name of expectedHandlers) {
  const exists = typeof availabilityController[name] === 'function';
  console.log(`  ${exists ? '✅' : '❌'} ${name}: ${exists ? 'OK' : 'MISSING'}`);
}

// Defensive wrapper
function handler(fn, name) {
  if (typeof fn !== 'function') {
    console.error(`\n[ FATAL ] availabilityController.${name} is UNDEFINED!`);
    console.error(`[ FATAL ] Add this function to availabilityController.js\n`);
    return (req, res) => {
      res.status(501).json({
        success: false,
        message: `Server misconfiguration: handler '${name}' not implemented`
      });
    };
  }
  return fn;
}

// ==========================================
// SPECIFIC ROUTES FIRST
// ==========================================

router.post('/set', protect, handler(availabilityController.setAvailability, 'setAvailability'));

router.post('/block', protect, handler(availabilityController.blockDate, 'blockDate'));

router.post('/unblock', protect, handler(availabilityController.unblockDate, 'unblockDate'));

router.get('/patterns', protect, handler(availabilityController.getRecurringPatterns, 'getRecurringPatterns'));

router.post('/patterns', protect, handler(availabilityController.createRecurringPattern, 'createRecurringPattern'));

router.delete(
  '/patterns/:patternId',
  protect,
  handler(availabilityController.deleteRecurringPattern, 'deleteRecurringPattern')
);

// ==========================================
// PARAMETERIZED ROUTES LAST
// ==========================================

router.get(
  '/:artisanId/check',
  handler(availabilityController.checkAvailability, 'checkAvailability')
);

router.get(
  '/:artisanId',
  handler(availabilityController.getAvailability, 'getAvailability')
);

// ==========================================
// DIAGNOSTIC: Check for any extra routes in your actual file
// If you have routes below this line, paste them here
// ==========================================

// DEBUG: List all properties of availabilityController to catch hidden ones
console.log('[availabilityRoutes] All controller keys:', Object.keys(availabilityController));

// If you have additional routes, they must use handler() wrapper:
// router.post('/your-route', protect, handler(availabilityController.yourFunction, 'yourFunction'));

module.exports = router;