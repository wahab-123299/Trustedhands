const Job = require('../models/Job');
const User = require('../models/User');
const mongoose = require('mongoose');

// ==========================================
// FILE A DISPUTE (Customer or Artisan)
// ==========================================
exports.fileDispute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: jobId } = req.params;
    const { reason, description, evidence = [] } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!reason || !description) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Reason and description are required'
        }
      });
    }

    // Find the job
    const job = await Job.findById(jobId).session(session);

    if (!job) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    // Check if user is involved in this job
    const isCustomer = job.customerId.toString() === userId.toString();
    const isArtisan = job.artisanId?.toString() === userId.toString();

    if (!isCustomer && !isArtisan) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to file a dispute for this job'
        }
      });
    }

    // Check if job is eligible for dispute
    const disputableStatuses = ['in_progress', 'completed', 'assigned'];
    if (!disputableStatuses.includes(job.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot file dispute for job with status: ${job.status}`
        }
      });
    }

    // Check if dispute already exists
    if (job.dispute && job.dispute.status !== 'resolved') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPUTE_EXISTS',
          message: 'A dispute is already in progress for this job'
        }
      });
    }

    // Create dispute
    const dispute = {
      filedBy: userId,
      filedByRole: isCustomer ? 'customer' : 'artisan',
      reason,
      description,
      evidence: evidence.map(url => ({
        url,
        uploadedAt: new Date()
      })),
      status: 'pending',
      filedAt: new Date()
    };

    // Update job with dispute
    job.dispute = dispute;
    job.status = 'disputed';
    
    await job.save({ session });
    await session.commitTransaction();

    // Notify other party (async, don't block response)
    notifyDisputeFiled(job, isCustomer ? 'artisan' : 'customer');

    res.status(201).json({
      success: true,
      message: 'Dispute filed successfully',
      data: {
        dispute: job.dispute,
        job: {
          _id: job._id,
          title: job.title,
          status: job.status
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('File dispute error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to file dispute'
      }
    });
  } finally {
    session.endSession();
  }
};

// ==========================================
// GET DISPUTES FOR A JOB
// ==========================================
exports.getJobDisputes = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const userId = req.user._id;

    const job = await Job.findById(jobId)
      .populate('dispute.filedBy', 'fullName profileImage')
      .populate('dispute.resolvedBy', 'fullName profileImage');

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    // Check authorization
    const isCustomer = job.customerId.toString() === userId.toString();
    const isArtisan = job.artisanId?.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isArtisan && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view disputes for this job'
        }
      });
    }

    if (!job.dispute) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No dispute found for this job'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        dispute: job.dispute
      }
    });

  } catch (error) {
    console.error('Get job disputes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch disputes'
      }
    });
  }
};

// ==========================================
// GET ALL DISPUTES (Admin only)
// ==========================================
exports.getAllDisputes = async (req, res) => {
  try {
    const { 
      status = 'pending',
      page = 1,
      limit = 20,
      sortBy = 'filedAt'
    } = req.query;

    const query = { 'dispute.status': status };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    if (sortBy === 'filedAt') sortOptions['dispute.filedAt'] = -1;
    else if (sortBy === 'budget') sortOptions.budget = -1;

    const jobs = await Job.find(query)
      .populate('customerId', 'fullName profileImage phone')
      .populate('artisanId', 'fullName profileImage phone')
      .populate('dispute.filedBy', 'fullName profileImage')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const total = await Job.countDocuments(query);

    const disputes = jobs.map(job => ({
      jobId: job._id,
      jobTitle: job.title,
      budget: job.budget,
      customer: job.customerId,
      artisan: job.artisanId,
      dispute: job.dispute
    }));

    res.status(200).json({
      success: true,
      data: {
        disputes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });

  } catch (error) {
    console.error('Get all disputes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch disputes'
      }
    });
  }
};

// ==========================================
// RESOLVE DISPUTE (Admin only)
// ==========================================
exports.resolveDispute = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { disputeId } = req.params;
    const { 
      resolution,
      refundAmount = 0,
      refundTo,
      notes 
    } = req.body;
    const adminId = req.user._id;

    // Validation
    if (!resolution || !['customer_favor', 'artisan_favor', 'compromise', 'dismissed'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid resolution type is required'
        }
      });
    }

    // Find job with this dispute
    const job = await Job.findOne({ 'dispute._id': disputeId }).session(session);

    if (!job || !job.dispute) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Dispute not found'
        }
      });
    }

    // Check if already resolved
    if (job.dispute.status === 'resolved') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_RESOLVED',
          message: 'This dispute has already been resolved'
        }
      });
    }

    // Update dispute
    job.dispute.status = 'resolved';
    job.dispute.resolution = {
      type: resolution,
      refundAmount: parseFloat(refundAmount) || 0,
      refundTo: refundTo || null,
      notes: notes || '',
      resolvedBy: adminId,
      resolvedAt: new Date()
    };

    // Update job status based on resolution
    if (resolution === 'customer_favor') {
      job.status = 'cancelled';
      job.cancelledAt = new Date();
      job.cancellationReason = 'Dispute resolved in customer favor';
    } else if (resolution === 'artisan_favor') {
      job.status = 'completed';
    } else if (resolution === 'compromise') {
      job.status = 'completed';
    }

    await job.save({ session });
    await session.commitTransaction();

    // Process refund if applicable (async)
    if (refundAmount > 0 && refundTo) {
      processRefund(job, refundAmount, refundTo);
    }

    // Notify parties
    notifyDisputeResolved(job, resolution);

    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully',
      data: {
        job: {
          _id: job._id,
          title: job.title,
          status: job.status,
          dispute: job.dispute
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Resolve dispute error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to resolve dispute'
      }
    });
  } finally {
    session.endSession();
  }
};

// ==========================================
// ADD EVIDENCE TO DISPUTE
// ==========================================
exports.addEvidence = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { evidenceUrls } = req.body;
    const userId = req.user._id;

    if (!evidenceUrls || !Array.isArray(evidenceUrls) || evidenceUrls.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Evidence URLs are required'
        }
      });
    }

    const job = await Job.findById(jobId);

    if (!job || !job.dispute) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job or dispute not found'
        }
      });
    }

    // Check authorization
    const isInvolved = 
      job.customerId.toString() === userId.toString() ||
      job.artisanId?.toString() === userId.toString();

    if (!isInvolved && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to add evidence'
        }
      });
    }

    // Check if dispute is still open
    if (job.dispute.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISPUTE_CLOSED',
          message: 'Cannot add evidence to resolved dispute'
        }
      });
    }

    // Add new evidence
    const newEvidence = evidenceUrls.map(url => ({
      url,
      uploadedBy: userId,
      uploadedAt: new Date()
    }));

    job.dispute.evidence.push(...newEvidence);
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Evidence added successfully',
      data: {
        evidence: job.dispute.evidence
      }
    });

  } catch (error) {
    console.error('Add evidence error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add evidence'
      }
    });
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function notifyDisputeFiled(job, notifyRole) {
  // TODO: Implement notification (email, push, socket)
  console.log(`[DISPUTE] Notifying ${notifyRole} about dispute on job ${job._id}`);
}

async function notifyDisputeResolved(job, resolution) {
  // TODO: Implement notification
  console.log(`[DISPUTE] Notifying parties about resolution: ${resolution} for job ${job._id}`);
}

async function processRefund(job, amount, recipient) {
  // TODO: Integrate with payment provider (Paystack/Flutterwave)
  console.log(`[REFUND] Processing ₦${amount} refund to ${recipient} for job ${job._id}`);
}

module.exports = exports;