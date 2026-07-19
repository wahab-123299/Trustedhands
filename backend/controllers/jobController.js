const Job = require('../models/Job');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
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

    // Notify nearby artisans
    try {
      const ArtisanProfile = require('../models/ArtisanProfile');
      const nearbyArtisans = await ArtisanProfile.find({
        'skills': { $in: [category] },
        'availability.status': 'available',
        'location.city': location?.city
      }).populate('userId', 'fullName email');

      for (const artisan of nearbyArtisans) {
        if (artisan.userId && artisan.userId.email) {
          await NotificationService.send({
            user: artisan.userId,
            type: 'new_job_alert',
            channels: ['in_app', 'email'],
            data: {
              jobTitle: job.title,
              jobId: job._id,
              location: job.location
            }
          });
        }
      }
      console.log(`[createJob] Notified ${nearbyArtisans.length} nearby artisans`);
    } catch (notifyError) {
      console.error('[createJob] Failed to notify artisans:', notifyError);
    }

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
    const { status, page = 1, limit = 20 } = req.query;

    const userIdStr = req.user._id?.toString?.() || String(req.user._id);
    const userId = new mongoose.Types.ObjectId(userIdStr);
    const userRole = req.user.role;

    console.log(`[getMyJobs] userId: ${userIdStr} role: ${userRole} page: ${page} limit: ${limit}`);

    let query = {};

    if (userRole === 'customer') {
      query.customerId = userId;
    } else if (userRole === 'artisan') {
      query.$or = [
        { artisanId: userId },
        { 'applications.artisanId': userId }
      ];
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
    const limitNum = parseInt(limit) || 20;
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

    // Notify artisan of job update
    try {
      if (job.artisanId) {
        const artisan = await User.findById(job.artisanId);
        if (artisan) {
          await NotificationService.send({
            user: artisan,
            type: 'job_update',
            channels: ['in_app', 'email'],
            data: {
              jobTitle: job.title,
              jobId: job._id,
              updatedFields: Object.keys(updates)
            }
          });
        }
      }
    } catch (e) {
      console.error('[updateJob] Notification failed:', e.message);
    }

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

    // Notify artisans who applied
    try {
      const applications = await Application.find({ jobId: id });
      for (const app of applications) {
        const artisan = await User.findById(app.artisanId);
        if (artisan) {
          await NotificationService.send({
            user: artisan,
            type: 'job_cancelled',
            channels: ['in_app', 'email'],
            data: {
              jobTitle: job.title,
              jobId: job._id
            }
          });
        }
      }
    } catch (e) {
      console.error('[deleteJob] Notification failed:', e.message);
    }

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

    // Notify customer about new application
    try {
      const customer = await User.findById(job.customerId);
      const artisan = await User.findById(artisanId);
      if (customer && customer.email) {
        await NotificationService.send({
          user: customer,
          type: 'application_received',
          channels: ['in_app', 'email'],
          data: {
            artisanName: artisan?.fullName || 'An artisan',
            jobTitle: job.title,
            jobId: job._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[applyForJob] Failed to notify customer:', notifyError);
    }

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

    // Notify artisan that application was accepted
    try {
      const artisan = await User.findById(application.artisanId);
      const customer = await User.findById(req.user._id);
      if (artisan && artisan.email) {
        await NotificationService.send({
          user: artisan,
          type: 'application_accepted',
          channels: ['in_app', 'email'],
          data: {
            jobTitle: job.title,
            jobId: job._id,
            customerName: customer?.fullName || 'A customer'
          }
        });
      }
    } catch (notifyError) {
      console.error('[acceptApplication] Failed to notify artisan:', notifyError);
    }

    // Book artisan's availability slot
    try {
      const { bookSlot } = require('../controllers/availabilityController');
      const scheduledDate = job.scheduledDate;
      if (scheduledDate) {
        const dateStr = scheduledDate.toISOString().split('T')[0];
        await bookSlot(
          application.artisanId,
          dateStr,
          '08:00',
          '18:00',
          job._id
        );
      }
    } catch (e) {
      console.error('[acceptApplication] Slot booking failed:', e.message);
    }

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

    // Notify artisan that application was rejected
    try {
      const artisan = await User.findById(application.artisanId);
      if (artisan && artisan.email) {
        await NotificationService.send({
          user: artisan,
          type: 'application_rejected',
          channels: ['in_app', 'email'],
          data: {
            jobTitle: application.jobId.title,
            jobId: application.jobId._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[rejectApplication] Failed to notify artisan:', notifyError);
    }

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

    // Notify customer that job was accepted/started
    try {
      const customer = await User.findById(job.customerId);
      const artisan = await User.findById(req.user._id);
      if (customer && customer.email) {
        await NotificationService.send({
          user: customer,
          type: 'job_started',
          channels: ['in_app', 'email'],
          data: {
            artisanName: artisan?.fullName || 'Your artisan',
            jobTitle: job.title,
            jobId: job._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[acceptJob] Failed to notify customer:', notifyError);
    }

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

    // Notify customer that job started
    try {
      const customer = await User.findById(job.customerId);
      const artisan = await User.findById(req.user._id);
      if (customer && customer.email) {
        await NotificationService.send({
          user: customer,
          type: 'job_started',
          channels: ['in_app', 'email'],
          data: {
            artisanName: artisan?.fullName || 'Your artisan',
            jobTitle: job.title,
            jobId: job._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[startJob] Failed to notify customer:', notifyError);
    }

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

    // Update hiredBefore in favorites
    try {
      const Favorite = require('../models/Favorite');
      await Favorite.findOneAndUpdate(
        { customerId: job.customerId, artisanId: job.artisanId },
        {
          $set: {
            hiredBefore: true,
            lastInteractedAt: new Date()
          },
          $inc: { hireCount: 1 }
        },
        { upsert: true }
      );
    } catch (e) {
      console.error('[completeJob] Favorite update failed:', e.message);
    }

    // Notify both parties when job is completed
    try {
      if (job.status === 'completed') {
        const customer = await User.findById(job.customerId);
        const artisan = await User.findById(job.artisanId);

        if (customer && customer.email) {
          await NotificationService.send({
            user: customer,
            type: 'job_completed',
            channels: ['in_app', 'email'],
            data: {
              artisanName: artisan?.fullName || 'Your artisan',
              jobTitle: job.title,
              jobId: job._id
            }
          });
        }

        if (artisan && artisan.email) {
          await NotificationService.send({
            user: artisan,
            type: 'job_completed',
            channels: ['in_app', 'email'],
            data: {
              customerName: customer?.fullName || 'Your customer',
              jobTitle: job.title,
              jobId: job._id
            }
          });
        }
      }
    } catch (notifyError) {
      console.error('[completeJob] Failed to send completion notifications:', notifyError);
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

    // Notify other party about cancellation
    try {
      const otherPartyId = isCustomer ? job.artisanId : job.customerId;
      const otherParty = await User.findById(otherPartyId);
      const canceller = await User.findById(req.user._id);

      if (otherParty && otherParty.email) {
        await NotificationService.send({
          user: otherParty,
          type: 'booking_declined',
          channels: ['in_app', 'email'],
          data: {
            artisanName: canceller?.fullName || 'The other party',
            jobTitle: job.title,
            jobId: job._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[cancelJob] Failed to notify other party:', notifyError);
    }

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

    // Notify artisan about new review
    try {
      const artisan = await User.findById(job.artisanId);
      const customer = await User.findById(req.user._id);
      if (artisan && artisan.email) {
        await NotificationService.send({
          user: artisan,
          type: 'review_received',
          channels: ['in_app', 'email'],
          data: {
            customerName: customer?.fullName || 'A customer',
            rating: rating,
            jobTitle: job.title,
            jobId: job._id
          }
        });
      }
    } catch (notifyError) {
      console.error('[addReview] Failed to notify artisan:', notifyError);
    }

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