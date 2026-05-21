const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const { AppError } = require('../utils/errorHandler');
const Milestone = require('../models/Milestone');

const PLATFORM_COMMISSION = 0.10;

// ==========================================
// CREATE MILESTONES FOR A JOB
// ==========================================
exports.createMilestones = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { milestones } = req.body;
    const userId = req.user._id;

    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one milestone is required');
    }

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    if (job.customerId.toString() !== userId.toString()) {
      throw new AppError('FORBIDDEN', 'Only the customer can create milestones');
    }

    if (job.status !== 'pending') {
      throw new AppError('INVALID_STATUS', 'Milestones can only be created for pending jobs');
    }

    // Validate milestone amounts sum to job budget
    const totalMilestoneAmount = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
    if (Math.abs(totalMilestoneAmount - job.budget) > 1) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Milestone amounts (₦${totalMilestoneAmount.toLocaleString()}) must equal job budget (₦${job.budget.toLocaleString()})`
      );
    }

    // Validate each milestone
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title || !m.amount || !m.dueDate) {
        throw new AppError('VALIDATION_ERROR', `Milestone ${i + 1} is missing required fields`);
      }
      if (m.amount < 1000) {
        throw new AppError('VALIDATION_ERROR', `Milestone ${i + 1} amount must be at least ₦1,000`);
      }
    }

    // Delete existing milestones if any
    await Milestone.deleteMany({ jobId });

    // Create milestones
    const createdMilestones = [];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const platformFee = Math.round(m.amount * PLATFORM_COMMISSION * 100) / 100;
      const artisanAmount = m.amount - platformFee;

      const milestone = await Milestone.create({
        jobId,
        title: m.title.trim(),
        description: m.description?.trim(),
        amount: m.amount,
        platformFee,
        artisanAmount,
        dueDate: new Date(m.dueDate),
        order: i + 1
      });

      createdMilestones.push(milestone);
    }

    // Mark job as having milestones
    job.hasMilestones = true;
    await job.save();

    // Notify artisan
    try {
      const artisan = await User.findById(job.artisanId);
      if (artisan) {
        await notificationService.notify({
          user: artisan,
          type: 'milestones_created',
          title: 'New Milestones Created',
          message: `${createdMilestones.length} milestone(s) have been created for "${job.title}". Total: ₦${job.budget.toLocaleString()}`,
          emailSubject: 'New Milestones - TrustedHand',
          emailHtml: `<p>Milestones created for "${job.title}"</p>`,
          data: {
            jobTitle: job.title,
            jobId: job._id,
            milestoneCount: createdMilestones.length,
            totalAmount: job.budget
          },
          link: `${process.env.FRONTEND_URL}/artisan/jobs/${job._id}`,
          channels: ['in_app', 'email']
        });
      }
    } catch (e) {
      console.error('[createMilestones] Notification failed:', e.message);
    }

    res.status(201).json({
      success: true,
      message: `${createdMilestones.length} milestone(s) created`,
      data: { milestones: createdMilestones }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET MILESTONES FOR A JOB
// ==========================================
exports.getMilestones = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    // Authorization: customer, artisan, or admin
    const isAuthorized = 
      job.customerId.toString() === req.user._id.toString() ||
      job.artisanId?.toString() === req.user._id.toString();

    if (!isAuthorized) {
      throw new AppError('FORBIDDEN', 'Not authorized to view these milestones');
    }

    const milestones = await Milestone.find({ jobId })
      .sort({ order: 1 })
      .lean();

    const progress = await Milestone.calculateProgress(jobId);
    const totalReleased = await Milestone.getTotalReleased(jobId);

    res.json({
      success: true,
      data: {
        milestones,
        progress,
        totalReleased,
        totalBudget: job.budget,
        remainingBudget: job.budget - totalReleased
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ARTISAN MARKS MILESTONE AS COMPLETED
// ==========================================
exports.completeMilestone = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;
    const { completionNote, deliverables } = req.body;
    const userId = req.user._id;

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new AppError('NOT_FOUND', 'Milestone not found');
    }

    const job = await Job.findById(milestone.jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    if (job.artisanId?.toString() !== userId.toString()) {
      throw new AppError('FORBIDDEN', 'Only the assigned artisan can complete milestones');
    }

    if (!['pending', 'in_progress', 'revision_requested'].includes(milestone.status)) {
      throw new AppError('INVALID_STATUS', `Cannot complete milestone with status: ${milestone.status}`);
    }

    // Check if previous milestone is completed
    if (milestone.order > 1) {
      const prevMilestone = await Milestone.findOne({
        jobId: milestone.jobId,
        order: milestone.order - 1
      });
      if (prevMilestone && !['approved', 'released'].includes(prevMilestone.status)) {
        throw new AppError('INVALID_STATUS', 'Previous milestone must be approved first');
      }
    }

    milestone.status = 'completed';
    milestone.completedAt = new Date();
    milestone.completedBy = userId;
    milestone.completionNote = completionNote?.trim();
    if (deliverables) {
      milestone.deliverables = deliverables.map(d => ({
        url: d.url,
        description: d.description,
        uploadedAt: new Date()
      }));
    }
    milestone.updatedAt = new Date();
    await milestone.save();

    // Update job status if first milestone
    if (milestone.order === 1 && job.status === 'assigned') {
      job.status = 'in_progress';
      job.startedAt = new Date();
      await job.save();
    }

    // Notify customer
    try {
      const customer = await User.findById(job.customerId);
      const artisan = await User.findById(userId);
      if (customer) {
        await notificationService.sendJobStatusUpdate(
          customer,
          job,
          'completed',
          artisan?.fullName || 'Artisan'
        );
      }
    } catch (e) {
      console.error('[completeMilestone] Notification failed:', e.message);
    }

    res.json({
      success: true,
      message: 'Milestone marked as completed',
      data: { milestone }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CUSTOMER APPROVES MILESTONE
// ==========================================
exports.approveMilestone = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;
    const { approvalNote } = req.body;
    const userId = req.user._id;

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new AppError('NOT_FOUND', 'Milestone not found');
    }

    const job = await Job.findById(milestone.jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    if (job.customerId.toString() !== userId.toString()) {
      throw new AppError('FORBIDDEN', 'Only the customer can approve milestones');
    }

    if (milestone.status !== 'completed') {
      throw new AppError('INVALID_STATUS', 'Milestone must be completed before approval');
    }

    milestone.status = 'approved';
    milestone.approvedAt = new Date();
    milestone.approvedBy = userId;
    milestone.approvalNote = approvalNote?.trim();
    milestone.updatedAt = new Date();
    await milestone.save();

    // Release payment for this milestone
    const releaseResult = await releaseMilestonePayment(milestone, job);

    // Check if all milestones are approved → complete job
    const allMilestones = await Milestone.find({ jobId: job._id });
    const allApproved = allMilestones.every(m => ['approved', 'released'].includes(m.status));

    if (allApproved && job.status !== 'completed') {
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();

      // Notify both parties
      try {
        const customer = await User.findById(job.customerId);
        const artisan = await User.findById(job.artisanId);

        if (customer) {
          await notificationService.sendJobStatusUpdate(
            customer,
            job,
            'completed',
            artisan?.fullName || 'Artisan'
          );
        }
        if (artisan) {
          await notificationService.sendPaymentReceived(
            artisan,
            { amount: milestone.artisanAmount, reference: `milestone_${milestone._id}` },
            job
          );
        }
      } catch (e) {
        console.error('[approveMilestone] Completion notification failed:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Milestone approved and payment released',
      data: { 
        milestone,
        paymentReleased: releaseResult,
        jobCompleted: allApproved
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CUSTOMER REQUESTS REVISION
// ==========================================
exports.requestRevision = async (req, res, next) => {
  try {
    const { milestoneId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new AppError('NOT_FOUND', 'Milestone not found');
    }

    const job = await Job.findById(milestone.jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    if (job.customerId.toString() !== userId.toString()) {
      throw new AppError('FORBIDDEN', 'Only the customer can request revisions');
    }

    if (milestone.status !== 'completed') {
      throw new AppError('INVALID_STATUS', 'Can only request revision for completed milestones');
    }

    milestone.status = 'revision_requested';
    milestone.revisionRequest = {
      requestedAt: new Date(),
      requestedBy: userId,
      reason: reason?.trim()
    };
    milestone.updatedAt = new Date();
    await milestone.save();

    // Notify artisan
    try {
      const artisan = await User.findById(job.artisanId);
      const customer = await User.findById(userId);
      if (artisan) {
        await notificationService.notify({
          user: artisan,
          type: 'milestone_revision',
          title: 'Revision Requested',
          message: `Customer requested revision for "${milestone.title}" in "${job.title}": ${reason}`,
          emailSubject: 'Revision Requested - TrustedHand',
          emailHtml: `<p>Revision requested for "${milestone.title}"</p>`,
          data: {
            milestoneTitle: milestone.title,
            jobTitle: job.title,
            jobId: job._id,
            reason: reason,
            customerName: customer?.fullName
          },
          link: `${process.env.FRONTEND_URL}/artisan/jobs/${job._id}`,
          channels: ['in_app', 'email']
        });
      }
    } catch (e) {
      console.error('[requestRevision] Notification failed:', e.message);
    }

    res.json({
      success: true,
      message: 'Revision requested',
      data: { milestone }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET MILESTONE PROGRESS
// ==========================================
exports.getMilestoneProgress = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    const milestones = await Milestone.find({ jobId }).sort({ order: 1 });
    const progress = await Milestone.calculateProgress(jobId);
    const totalReleased = await Milestone.getTotalReleased(jobId);

    // Determine current active milestone
    let currentMilestone = null;
    for (const m of milestones) {
      if (['pending', 'in_progress', 'completed', 'revision_requested'].includes(m.status)) {
        currentMilestone = m;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        milestones,
        progress,
        totalReleased,
        totalBudget: job.budget,
        remainingBudget: job.budget - totalReleased,
        currentMilestone,
        isComplete: progress === 100
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// HELPER: Release payment for a milestone
// ==========================================
async function releaseMilestonePayment(milestone, job) {
  try {
    // Create transaction record
    const transaction = await Transaction.create({
      jobId: job._id,
      payerId: job.customerId,
      payeeId: job.artisanId,
      amount: milestone.amount,
      platformFee: milestone.platformFee,
      artisanAmount: milestone.artisanAmount,
      type: 'payment',
      status: 'released',
      description: `Milestone payment: ${milestone.title}`,
      metadata: {
        milestoneId: milestone._id.toString(),
        milestoneTitle: milestone.title,
        milestoneOrder: milestone.order
      }
    });

    // Update milestone
    milestone.status = 'released';
    milestone.transactionId = transaction._id;
    milestone.updatedAt = new Date();
    await milestone.save();

    // Credit artisan wallet
    const wallet = await Wallet.findOne({ artisanId: job.artisanId });
    if (wallet) {
      await wallet.creditBalance(milestone.artisanAmount, transaction._id);
    }

    // Update job payment tracking
    const totalReleased = await Milestone.getTotalReleased(job._id);
    if (totalReleased >= job.budget) {
      job.paymentStatus = 'released';
    } else {
      job.paymentStatus = 'partially_released';
    }
    await job.save();

    // Notify artisan
    try {
      const artisan = await User.findById(job.artisanId);
      if (artisan) {
        await notificationService.sendPaymentReceived(
          artisan,
          transaction,
          job
        );
      }
    } catch (e) {
      console.error('[releaseMilestonePayment] Notification failed:', e.message);
    }

    return { success: true, transactionId: transaction._id };
  } catch (error) {
    console.error('[releaseMilestonePayment] Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// STEP 3: Create routes/milestoneRoutes.js
// ==========================================
/*
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
*/

// ==========================================
// STEP 4: Add to app.js
// ==========================================
/*
// Add this line with other routes:
app.use('/api/milestones', require('./routes/milestoneRoutes'));
*/

// ==========================================
// STEP 5: Add to models/index.js
// ==========================================
/*
const Milestone = require('./Milestone');

module.exports = {
  // ... existing exports ...
  Milestone
};
*/

// ==========================================
// STEP 6: Add hasMilestones field to Job model
// In models/Job.js, add inside schema:
// ==========================================
/*
hasMilestones: {
  type: Boolean,
  default: false
},
*/

// ==========================================
// STEP 7: Modify payment flow for milestone jobs
// In paymentController.js initializePayment(), check if job has milestones:
// ==========================================
/*
// ADD at start of initializePayment:
if (job.hasMilestones) {
  throw new AppError(
    'JOB_HAS_MILESTONES',
    'This job uses milestone-based payments. Please use the milestone payment endpoints.'
  );
}
*/

module.exports = {
  createMilestones: exports.createMilestones,
  getMilestones: exports.getMilestones,
  completeMilestone: exports.completeMilestone,
  approveMilestone: exports.approveMilestone,
  requestRevision: exports.requestRevision,
  getMilestoneProgress: exports.getMilestoneProgress
};

