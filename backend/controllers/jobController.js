const Job = require('../models/Job');
const User = require('../models/User');
const Application = require('../models/Application');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// ==========================================
// GET ALL JOBS (Public - with filters)
// ==========================================
exports.getAllJobs = async (req, res) => {
  try {
    const { status, category, location, page = 1, limit = 10, search } = req.query;
    
    let query = {};

    if (status) {
      const statusStr = String(status);
      if (statusStr.includes(',')) {
        query.status = { $in: statusStr.split(',').map(s => s.trim()) };
      } else {
        query.status = statusStr.trim();
      }
    }

    if (category) query.category = category;
    if (location) query['location.city'] = { $regex: location, $options: 'i' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const jobs = await Job.find(query)
      .populate('customerId', 'fullName profileImage')
      .populate('artisanId', 'fullName profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Job.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('[getAllJobs] ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch jobs'
      }
    });
  }
};

// ==========================================
// GET JOB BY ID (Public)
// ==========================================
exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid job ID format'
        }
      });
    }

    const job = await Job.findById(id)
      .populate('customerId', 'fullName profileImage phone')
      .populate('artisanId', 'fullName profileImage phone')
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    res.status(200).json({
      success: true,
      data: { job }
    });
  } catch (error) {
    console.error('[getJobById] ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch job'
      }
    });
  }
};

// ==========================================
// CREATE JOB (Customer only)
// ==========================================
exports.createJob = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const {
      title,
      description,
      category,
      budget,
      scheduledDate,
      location,
      images,
      tags
    } = req.body;

    const job = await Job.create({
      customerId: req.user._id,
      title,
      description,
      category,
      budget: budget ? parseFloat(budget) : null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      location,
      images: images || [],
      tags: tags || [],
      status: 'pending'
    });

    await job.populate('customerId', 'fullName profileImage');

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: { job }
    });
  } catch (error) {
    console.error('[createJob] ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create job'
      }
    });
  }
};

// ==========================================
// GET MY JOBS (Customer or Artisan)
// ==========================================
exports.getMyJobs = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const userIdStr = req.user._id?.toString?.() || String(req.user._id);
    const userId = new mongoose.Types.ObjectId(userIdStr);
    const userRole = req.user.role;

    console.log('[getMyJobs] userId:', userIdStr, 'role:', userRole);

    let query = {};

    if (userRole === 'customer') {
      query.customerId = userId;
    } else if (userRole === 'artisan') {
      query.artisanId = userId;
    }

    if (status) {
      const statusStr = String(status);
      if (statusStr.includes(',')) {
        query.status = { $in: statusStr.split(',').map(s => s.trim()) };
      } else {
        query.status = statusStr.trim();
      }
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const jobs = await Job.find(query)
      .populate('customerId', 'fullName profileImage')
      .populate('artisanId', 'fullName profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Job.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('[getMyJobs] ERROR:', error.name, error.message);
    console.error('[getMyJobs] STACK:', error.stack);

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? `${error.name}: ${error.message}` : 'Failed to fetch jobs'
      }
    });
  }
};

// ==========================================
// UPDATE JOB (Customer only)
// ==========================================
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const job = await Job.findOne({
      _id: id,
      customerId: req.user._id,
      status: { $in: ['pending', 'assigned'] }
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found or cannot be updated'
        }
      });
    }

    const allowedUpdates = ['title', 'description', 'budget', 'scheduledDate', 'location'];
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        job[key] = updates[key];
      }
    });

    await job.save();
    await job.populate('customerId', 'fullName profileImage');

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update job'
      }
    });
  }
};

// ==========================================
// DELETE JOB (Customer only)
// ==========================================
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findOneAndDelete({
      _id: id,
      customerId: req.user._id,
      status: 'pending'
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found or cannot be deleted'
        }
      });
    }

    await Application.deleteMany({ jobId: id });

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete job'
      }
    });
  }
};

// ==========================================
// APPLY FOR JOB (Artisan only)
// ==========================================
exports.applyForJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { coverLetter, proposedRate } = req.body;
    const artisanId = req.user._id;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This job is no longer accepting applications'
        }
      });
    }

    const existingApplication = await Application.findOne({
      jobId: id,
      artisanId
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_APPLIED',
          message: 'You have already applied for this job'
        }
      });
    }

    const application = await Application.create({
      jobId: id,
      artisanId,
      coverLetter,
      proposedRate: proposedRate ? parseInt(proposedRate) : null,
      status: 'pending'
    });

    await application.populate('artisanId', 'fullName profileImage');

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Apply for job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to submit application'
      }
    });
  }
};

// ==========================================
// ACCEPT APPLICATION (Customer only)
// ==========================================
exports.acceptApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Application not found'
        }
      });
    }

    if (application.jobId.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to accept this application'
        }
      });
    }

    application.status = 'accepted';
    await application.save();

    const job = await Job.findByIdAndUpdate(
      application.jobId._id,
      {
        status: 'assigned',
        artisanId: application.artisanId
      },
      { new: true }
    );

    await Application.updateMany(
      {
        jobId: application.jobId._id,
        _id: { $ne: applicationId }
      },
      { status: 'rejected' }
    );

    res.status(200).json({
      success: true,
      message: 'Application accepted successfully',
      data: { job, application }
    });
  } catch (error) {
    console.error('Accept application error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept application'
      }
    });
  }
};

// ==========================================
// GET JOB APPLICATIONS (Customer only)
// ==========================================
exports.getJobApplications = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to view these applications'
        }
      });
    }

    const applications = await Application.find({ jobId: id })
      .populate('artisanId', 'fullName profileImage phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { applications }
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch applications'
      }
    });
  }
};

// ==========================================
// UPDATE JOB STATUS
// ==========================================
exports.updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'assigned', 'in-progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Invalid status value'
        }
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    const isCustomer = job.customerId.toString() === req.user._id.toString();
    const isArtisan = job.artisanId?.toString() === req.user._id.toString();

    if (!isCustomer && !isArtisan) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to update this job'
        }
      });
    }

    job.status = status;
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job status updated successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update job status'
      }
    });
  }
};

// ==========================================
// REJECT APPLICATION (Customer only)
// ==========================================
exports.rejectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Application not found'
        }
      });
    }

    if (application.jobId.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to reject this application'
        }
      });
    }

    application.status = 'rejected';
    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application rejected successfully',
      data: { application }
    });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to reject application'
      }
    });
  }
};

// ==========================================
// ACCEPT JOB (Artisan accepts assigned job)
// ==========================================
exports.acceptJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.artisanId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not assigned to this job'
        }
      });
    }

    job.status = 'in-progress';
    job.startedAt = new Date();
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job accepted and started',
      data: { job }
    });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept job'
      }
    });
  }
};

// ==========================================
// START JOB
// ==========================================
exports.startJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.artisanId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only assigned artisan can start this job'
        }
      });
    }

    if (job.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Job must be assigned before starting'
        }
      });
    }

    job.status = 'in_progress';
    job.startedAt = new Date();
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job started successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to start job'
      }
    });
  }
};

// ==========================================
// COMPLETE JOB
// ==========================================
exports.completeJob = async (req, res) => {
  try {
    const { id } = req.params;
    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Job must be in progress to complete'
        }
      });
    }

    const isCustomer = job.customerId.toString() === req.user._id.toString();
    const isArtisan = job.artisanId?.toString() === req.user._id.toString();

    if (!isCustomer && !isArtisan) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to complete this job'
        }
      });
    }

    if (isCustomer) {
      await job.confirmByCustomer();
    } else {
      await job.confirmByArtisan();
    }

    res.status(200).json({
      success: true,
      message: 'Job completion confirmed',
      data: { job }
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to complete job'
      }
    });
  }
};

// ==========================================
// CONFIRM COMPLETION (Alias for completeJob)
// ==========================================
exports.confirmCompletion = async (req, res) => {
  return exports.completeJob(req, res);
};

// ==========================================
// CANCEL JOB
// ==========================================
exports.cancelJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    const isCustomer = job.customerId.toString() === req.user._id.toString();
    const isArtisan = job.artisanId?.toString() === req.user._id.toString();

    if (!isCustomer && !isArtisan) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to cancel this job'
        }
      });
    }

    if (!job.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This job cannot be cancelled at this stage'
        }
      });
    }

    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.cancellationReason = reason;
    job.cancelledBy = req.user._id;
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job cancelled successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Cancel job error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to cancel job'
      }
    });
  }
};

// ==========================================
// ADD REVIEW
// ==========================================
exports.addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Rating must be between 1 and 5'
        }
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Job not found'
        }
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Can only review completed jobs'
        }
      });
    }

    if (job.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the customer can review this job'
        }
      });
    }

    if (job.review?.rating) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REVIEWED',
          message: 'You have already reviewed this job'
        }
      });
    }

    job.review = {
      rating,
      comment: comment?.trim(),
      createdAt: new Date()
    };
    await job.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: { review: job.review }
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add review'
      }
    });
  }
};

// ==========================================
// APPROVE MILESTONE (placeholder)
// ==========================================
exports.approveMilestone = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Milestone approval not yet implemented'
  });
};

// Debug exports
console.log('Exported functions:', Object.keys(exports));
console.log('cancelJob exists:', typeof exports.cancelJob);