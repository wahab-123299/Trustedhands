const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');
const disputeController = require('../controllers/disputeController');

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

// Get all jobs (with filters, pagination, etc.)
router.get('/', jobController.getAllJobs);


// ============================================
// STATIC PROTECTED ROUTES (must be BEFORE /:id)
// These are specific paths that would be caught by /:id if placed below it
// ============================================

// Get current user's jobs (customer or artisan)
router.get('/my-jobs', authenticate, jobController.getMyJobs);


// ============================================
// DYNAMIC ROUTES (/:id) - MUST BE LAST
// ============================================

// Get single job by ID
router.get('/:id', jobController.getJobById);

// Update job (customer only)
router.put('/:id', authenticate, authorize('customer'), jobController.updateJob);

// Delete job (customer only)
router.delete('/:id', authenticate, authorize('customer'), jobController.deleteJob);

// Create new job (customer only) - Note: POST / should ideally be above /:id too
// but POST / doesn't conflict with GET /:id, so order matters less for different methods
router.post('/', authenticate, authorize('customer'), jobController.createJob);


// ============================================
// JOB APPLICATIONS (nested under /:id)
// ============================================

// Apply for job (artisan only)
router.post('/:id/apply', authenticate, authorize('artisan'), jobController.applyForJob);

// Get applications for a job (customer only)
router.get('/:id/applications', authenticate, authorize('customer'), jobController.getJobApplications);

// Accept application (customer only)
router.post('/applications/:applicationId/accept', authenticate, authorize('customer'), jobController.acceptApplication);

// Reject application (customer only)
router.post('/applications/:applicationId/reject', authenticate, authorize('customer'), jobController.rejectApplication);


// ============================================
// JOB STATUS WORKFLOW
// ============================================

// Update job status (general status update)
router.put('/:id/status', authenticate, jobController.updateJobStatus);

// Accept job (artisan accepts assigned job)
router.post('/:id/accept', authenticate, authorize('artisan'), jobController.acceptJob);

// Start job (artisan begins work)
router.post('/:id/start', authenticate, authorize('artisan'), jobController.startJob);

// Complete job (artisan marks as done)
router.post('/:id/complete', authenticate, jobController.completeJob);

// Confirm completion (customer approves)
router.post('/:id/confirm', authenticate, authorize('customer'), jobController.confirmCompletion);

// Cancel job
router.put('/:id/cancel', authenticate, jobController.cancelJob);


// ============================================
// REVIEWS & MILESTONES
// ============================================

// Add review (customer only)
router.post('/:id/review', authenticate, authorize('customer'), jobController.addReview);

// Approve milestone payment
router.put('/:id/milestones/:milestoneIndex/approve', authenticate, jobController.approveMilestone);


// ============================================
// DISPUTES
// ============================================

// File dispute
router.post('/:id/disputes', authenticate, disputeController.fileDispute);

// Get job disputes
router.get('/:id/disputes', authenticate, disputeController.getJobDisputes);


// ============================================
// ADMIN ROUTES
// ============================================

// Get all disputes (admin)
router.get('/admin/disputes', authenticate, authorize('admin'), disputeController.getAllDisputes);

// Resolve dispute (admin)
router.put('/admin/disputes/:disputeId/resolve', authenticate, authorize('admin'), disputeController.resolveDispute);


module.exports = router;