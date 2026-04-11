const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getMyApplications,
  getApplicationById,
  withdrawApplication
} = require('../controllers/applicationController');

// All routes are protected
router.use(authenticate);

// Get my applications
router.get('/my-applications', getMyApplications);

// Get single application
router.get('/:id', getApplicationById);

// Withdraw application
router.put('/:id/withdraw', withdrawApplication);

module.exports = router;