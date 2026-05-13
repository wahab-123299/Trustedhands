const express = require('express');
const router = express.Router();
const milestoneController = require('../controllers/milestoneController');
const { authenticate } = require('../middleware/auth');

router.post('/job/:jobId', authenticate, milestoneController.createMilestones);
router.get('/job/:jobId', authenticate, milestoneController.getMilestones);
router.get('/job/:jobId/progress', authenticate, milestoneController.getMilestoneProgress);
router.post('/:milestoneId/complete', authenticate, milestoneController.completeMilestone);
router.post('/:milestoneId/approve', authenticate, milestoneController.approveMilestone);
router.post('/:milestoneId/revision', authenticate, milestoneController.requestRevision);

module.exports = router;