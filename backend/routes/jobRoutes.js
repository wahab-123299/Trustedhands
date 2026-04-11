const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// ==========================================
// PUBLIC ROUTES - Static first!
// ==========================================
router.get('/', jobController.getAllJobs);
router.get('/all', jobController.getAllJobs);
router.get('/my-jobs', authenticate, jobController.getMyJobs);

// ==========================================
// PUBLIC ROUTES - Parameterized
// ==========================================
router.get('/:id', jobController.getJobById);

// ==========================================
// CUSTOMER ONLY ROUTES
// ==========================================
router.post('/', authenticate, authorize('customer'), jobController.createJob);
router.put('/:id', authenticate, authorize('customer'), jobController.updateJob);
router.delete('/:id', authenticate, authorize('customer'), jobController.deleteJob);
router.get('/:id/applications', authenticate, authorize('customer'), jobController.getJobApplications);

// Application management - ONLY KEEP WHAT EXISTS
router.post('/applications/:applicationId/accept', authenticate, authorize('customer'), jobController.acceptApplication);
// router.post('/applications/:applicationId/reject', authenticate, authorize('customer'), jobController.rejectApplication); // COMMENT OUT

// ==========================================
// ARTISAN ONLY ROUTES
// ==========================================
router.post('/:id/apply', authenticate, authorize('artisan'), jobController.applyForJob);

// ==========================================
// JOB STATUS ROUTES (Both roles) - COMMENT OUT ALL FOR NOW
// ==========================================
// router.put('/:id/accept', authenticate, jobController.acceptJob);
// router.put('/:id/start', authenticate, jobController.startJob);
// router.put('/:id/complete', authenticate, jobController.completeJob);
// router.put('/:id/confirm-completion', authenticate, jobController.confirmCompletion);
// router.put('/:id/cancel', authenticate, jobController.cancelJob);
router.put('/:id/status', authenticate, jobController.updateJobStatus);

// ==========================================
// REVIEWS - COMMENT OUT FOR NOW
// ==========================================
// router.post('/:id/review', authenticate, jobController.addReview);

module.exports = router;