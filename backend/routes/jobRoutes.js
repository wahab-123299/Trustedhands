const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');
const disputeController = require('../controllers/disputeController');

// Public routes
router.get('/', jobController.getAllJobs);
router.get('/:id', jobController.getJobById);

// Protected - Customer
router.post('/', authenticate, authorize('customer'), jobController.createJob);
router.get('/my/jobs', authenticate, jobController.getMyJobs);
router.put('/:id', authenticate, authorize('customer'), jobController.updateJob);
router.delete('/:id', authenticate, authorize('customer'), jobController.deleteJob);

// Applications
router.post('/:id/apply', authenticate, authorize('artisan'), jobController.applyForJob);
router.get('/:id/applications', authenticate, authorize('customer'), jobController.getJobApplications);
router.post('/applications/:applicationId/accept', authenticate, authorize('customer'), jobController.acceptApplication);
router.post('/applications/:applicationId/reject', authenticate, authorize('customer'), jobController.rejectApplication);

// Job status
router.put('/:id/status', authenticate, jobController.updateJobStatus);
router.post('/:id/accept', authenticate, authorize('artisan'), jobController.acceptJob);
router.post('/:id/start', authenticate, authorize('artisan'), jobController.startJob);
router.post('/:id/complete', authenticate, jobController.completeJob);



router.post('/:id/review', authenticate, authorize('customer'), jobController.addReview);

// ESCROW & DISPUTES
router.post('/:id/disputes', authenticate, disputeController.fileDispute);
router.get('/:id/disputes', authenticate, disputeController.getJobDisputes);
router.put('/:id/milestones/:milestoneIndex/approve', authenticate, jobController.approveMilestone);

router.put('/:id/cancel', authenticate, jobController.cancelJob);
// Admin routes
router.get('/admin/disputes', authenticate, authorize('admin'), disputeController.getAllDisputes);
router.put('/admin/disputes/:disputeId/resolve', authenticate, authorize('admin'), disputeController.resolveDispute);


module.exports = router;