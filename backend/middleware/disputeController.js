const Dispute = require('../models/Dispute');
const Job = require('../models/Job');
const { AppError } = require('../utils/errorHandler');

// File a dispute
exports.fileDispute = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { milestoneIndex, issueType, description, desiredOutcome, partialAmount } = req.body;
    const userId = req.user._id;

    const job = await Job.findById(jobId);
    if (!job) throw new AppError('NOT_FOUND', 'Job not found');

    // Authorization check
    const isCustomer = job.customerId.toString() === userId.toString();
    const isArtisan = job.artisanId?.toString() === userId.toString();
    if (!isCustomer && !isArtisan) {
      throw new AppError('UNAUTHORIZED', 'Not authorized to dispute this job');
    }

    // Validate milestone
    const milestone = job.escrowMilestones[milestoneIndex];
    if (!milestone) throw new AppError('VALIDATION_ERROR', 'Invalid milestone');
    if (milestone.status === 'released') {
      throw new AppError('VALIDATION_ERROR', 'Payment already released');
    }
    if (milestone.status === 'disputed') {
      throw new AppError('VALIDATION_ERROR', 'Already under dispute');
    }

    // Create dispute
    const dispute = await Dispute.create({
      jobId,
      milestoneIndex,
      filedBy: userId,
      issueType,
      description,
      desiredOutcome,
      partialAmount: desiredOutcome === 'partial' ? partialAmount : null,
      status: 'pending',
      resolutionTime: job.budget < 20000 ? 24 : 72
    });

    // Update job milestone
    job.escrowMilestones[milestoneIndex].status = 'disputed';
    await job.save();

    res.json({
      success: true,
      message: 'Dispute filed successfully',
      data: {
        dispute,
        resolutionTime: dispute.resolutionTime,
        message: `Resolution in ${dispute.resolutionTime} hours`
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get disputes for a job
exports.getJobDisputes = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    
    const disputes = await Dispute.find({ jobId })
      .populate('filedBy', 'fullName role')
      .populate('resolution.decidedBy', 'fullName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { disputes }
    });
  } catch (error) {
    next(error);
  }
};

// Approve milestone (release payment)
exports.approveMilestone = async (req, res, next) => {
  try {
    const { jobId, milestoneIndex } = req.params;
    const userId = req.user._id;

    const job = await Job.findById(jobId);
    if (!job) throw new AppError('NOT_FOUND', 'Job not found');

    // Only customer can approve
    if (job.customerId.toString() !== userId.toString()) {
      throw new AppError('UNAUTHORIZED', 'Only customer can release payment');
    }

    const milestone = job.escrowMilestones[milestoneIndex];
    if (!milestone) throw new AppError('VALIDATION_ERROR', 'Invalid milestone');

    if (milestone.status === 'released') {
      throw new AppError('VALIDATION_ERROR', 'Already released');
    }

    // Update milestone
    milestone.status = 'approved';
    milestone.approvedAt = new Date();
    milestone.approvedBy = userId;

    await job.save();

    // TODO: Trigger actual payment release via payment controller
    // await releasePayment(jobId, milestoneIndex);

    res.json({
      success: true,
      message: 'Payment approved for release',
      data: { milestone }
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Resolve dispute
exports.resolveDispute = async (req, res, next) => {
  try {
    const { disputeId } = req.params;
    const { decision, reason, amount } = req.body;
    const adminId = req.user._id;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found');

    dispute.status = 'resolved';
    dispute.resolution = {
      decision,
      reason,
      amount,
      decidedBy: adminId,
      decidedAt: new Date()
    };

    await dispute.save();

    // Update job milestone based on decision
    const job = await Job.findById(dispute.jobId);
    const milestone = job.escrowMilestones[dispute.milestoneIndex];

    if (decision === 'full_refund') {
      milestone.status = 'refunded';
    } else if (decision === 'partial_refund') {
      milestone.status = 'partially_released';
      milestone.partialAmount = amount;
    } else if (decision === 'release_to_artisan') {
      milestone.status = 'approved';
    }

    await job.save();

    res.json({
      success: true,
      message: 'Dispute resolved',
      data: { dispute, job }
    });
  } catch (error) {
    next(error);
  }
};

// Get all disputes (admin)
exports.getAllDisputes = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;

    const disputes = await Dispute.find(query)
      .populate('jobId', 'title budget')
      .populate('filedBy', 'fullName role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Dispute.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};