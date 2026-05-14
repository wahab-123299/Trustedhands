const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { protect } = require('../middleware/authMiddleware');

router.post('/job/:jobId', protect, milestoneController.createMilestones);
router.get('/job/:jobId', protect, milestoneController.getMilestones);
router.get('/job/:jobId/progress', protect, milestoneController.getMilestoneProgress);
router.post('/:milestoneId/complete', protect, milestoneController.completeMilestone);
router.post('/:milestoneId/approve', protect, milestoneController.approveMilestone);
router.post('/:milestoneId/revision', protect, milestoneController.requestRevision);

module.exports = router;