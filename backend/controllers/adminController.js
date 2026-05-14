const User = require('../models/User');
const Job = require('../models/Job');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const ArtisanProfile = require('../models/ArtisanProfile');
const Application = require('../models/Application');
const NotificationService = require('../services/notificationService');
const { AppError } = require('../utils/errorHandler');
const {protect} = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// ==========================================
// ADMIN DASHBOARD STATS
// ==========================================
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // User stats
    const totalUsers = await User.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalArtisans = await User.countDocuments({ role: 'artisan' });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Job stats
    const totalJobs = await Job.countDocuments();
    const pendingJobs = await Job.countDocuments({ status: 'pending' });
    const inProgressJobs = await Job.countDocuments({ status: 'in_progress' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });
    const disputedJobs = await Job.countDocuments({ status: 'disputed' });
    const newJobsThisWeek = await Job.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Revenue stats
    const revenueStats = await Transaction.aggregate([
      {
        $match: {
          type: 'payment',
          status: { $in: ['success', 'released'] }
        }
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: '$amount' },
          totalFees: { $sum: '$platformFee' },
          totalArtisanPayouts: { $sum: '$artisanAmount' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const revenue = revenueStats[0] || {
      totalVolume: 0,
      totalFees: 0,
      totalArtisanPayouts: 0,
      transactionCount: 0
    };

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRevenue = await Transaction.aggregate([
      {
        $match: {
          type: 'payment',
          status: { $in: ['success', 'released'] },
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' },
          fees: { $sum: '$platformFee' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Withdrawal stats
    const withdrawalStats = await Transaction.aggregate([
      { $match: { type: 'withdrawal' } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Dispute stats
    const activeDisputes = await Job.countDocuments({
      'dispute.status': 'pending'
    });
    const totalDisputes = await Job.countDocuments({
      'dispute.status': { $ne: null }
    });

    // Top categories
    const topCategories = await Job.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Top locations
    const topLocations = await Job.aggregate([
      {
        $group: {
          _id: '$location.state',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          customers: totalCustomers,
          artisans: totalArtisans,
          newThisMonth: newUsersThisMonth
        },
        jobs: {
          total: totalJobs,
          pending: pendingJobs,
          inProgress: inProgressJobs,
          completed: completedJobs,
          disputed: disputedJobs,
          newThisWeek: newJobsThisWeek,
          completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0
        },
        revenue,
        monthlyRevenue: monthlyRevenue.map(m => ({
          month: `${m._id.year}-${m._id.month.toString().padStart(2, '0')}`,
          revenue: m.revenue,
          fees: m.fees,
          count: m.count
        })),
        withdrawals: withdrawalStats.reduce((acc, w) => {
          acc[w._id] = { total: w.total, count: w.count };
          return acc;
        }, {}),
        disputes: {
          active: activeDisputes,
          total: totalDisputes
        },
        topCategories,
        topLocations
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ALL USERS (Admin)
// ==========================================
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, role, search, isActive } = req.query;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password -refreshTokens -blacklistedTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ACTIVATE/DEACTIVATE USER
// ==========================================
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password -refreshTokens -blacklistedTokens');

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'}`,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ALL TRANSACTIONS (Admin)
// ==========================================
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type, status, startDate, endDate } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .populate('payerId', 'fullName email')
      .populate('payeeId', 'fullName email')
      .populate('jobId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET ALL DISPUTES
// ==========================================
exports.getAllDisputes = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status = 'pending' } = req.query;

    const query = { 'dispute.status': status };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const disputes = await Job.find(query)
      .populate('customerId', 'fullName email phone')
      .populate('artisanId', 'fullName email phone')
      .select('title budget status dispute customerConfirmed artisanConfirmed createdAt')
      .sort({ 'dispute.filedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      data: {
        disputes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// RESOLVE DISPUTE
// ==========================================
exports.resolveDispute = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { resolution, refundAmount, refundTo, notes } = req.body;
    const adminId = req.user._id;

    const validResolutions = ['customer_favor', 'artisan_favor', 'compromise', 'dismissed'];
    if (!validResolutions.includes(resolution)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid resolution type');
    }

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('NOT_FOUND', 'Job not found');
    }

    if (!job.dispute || job.dispute.status !== 'pending') {
      throw new AppError('INVALID_STATUS', 'No active dispute found for this job');
    }

    // Update dispute resolution
    job.dispute.status = 'resolved';
    job.dispute.resolution = {
      type: resolution,
      refundAmount: refundAmount || 0,
      refundTo: refundTo || null,
      notes: notes?.trim(),
      resolvedBy: adminId,
      resolvedAt: new Date()
    };

    // Handle financial resolution
    if (resolution === 'customer_favor' && refundAmount > 0) {
      // Refund customer
      const transaction = await Transaction.findOne({ jobId, type: 'payment' });
      if (transaction) {
        await Transaction.create({
          jobId,
          payerId: job.artisanId,
          payeeId: job.customerId,
          amount: refundAmount,
          type: 'refund',
          status: 'success',
          description: `Dispute refund for: ${job.title}`,
          metadata: {
            disputeResolution: resolution,
            adminId: adminId.toString()
          }
        });
      }
    } else if (resolution === 'artisan_favor') {
      // Release payment to artisan if held
      const transaction = await Transaction.findOne({ jobId, type: 'payment', status: 'success' });
      if (transaction) {
        const wallet = await Wallet.findOne({ artisanId: job.artisanId });
        if (wallet) {
          await wallet.releasePendingBalance(transaction.artisanAmount);
        }
        await transaction.releasePayment();
      }
      job.paymentStatus = 'released';
    }

    job.status = 'completed';
    await job.save();

    // Notify parties
    try {
      const customer = await User.findById(job.customerId);
      const artisan = await User.findById(job.artisanId);

      const notificationData = {
        jobTitle: job.title,
        jobId: job._id,
        resolution: resolution,
        refundAmount: refundAmount
      };

      if (customer) {
        await NotificationService.send({
          user: customer,
          type: 'dispute_resolved',
          channels: ['in_app', 'email'],
          data: notificationData
        });
      }
      if (artisan) {
        await NotificationService.send({
          user: artisan,
          type: 'dispute_resolved',
          channels: ['in_app', 'email'],
          data: notificationData
        });
      }
    } catch (e) {
      console.error('[resolveDispute] Notification failed:', e.message);
    }

    res.json({
      success: true,
      message: 'Dispute resolved successfully',
      data: { job }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ARTISAN ANALYTICS
// ==========================================
exports.getArtisanAnalytics = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { period = '30d' } = req.query;

    // Authorization: artisan can view own, admin can view any
    const isOwn = req.user._id.toString() === artisanId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwn && !isAdmin) {
      throw new AppError('FORBIDDEN', 'Not authorized to view these analytics');
    }

    const now = new Date();
    let startDate;
    switch (period) {
      case '7d': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
      case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Job statistics
    const jobStats = await Job.aggregate([
      {
        $match: {
          artisanId: new mongoose.Types.ObjectId(artisanId),
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBudget: { $sum: '$budget' }
        }
      }
    ]);

    const jobStatusMap = {};
    jobStats.forEach(s => {
      jobStatusMap[s._id] = { count: s.count, totalBudget: s.totalBudget };
    });

    // Earnings
    const earnings = await Transaction.aggregate([
      {
        $match: {
          payeeId: new mongoose.Types.ObjectId(artisanId),
          type: { $in: ['payment', 'payout'] },
          status: { $in: ['success', 'released'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$artisanAmount' },
          totalPlatformFees: { $sum: '$platformFee' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const earningsData = earnings[0] || {
      totalEarned: 0,
      totalPlatformFees: 0,
      transactionCount: 0
    };

    // Monthly earnings breakdown
    const monthlyEarnings = await Transaction.aggregate([
      {
        $match: {
          payeeId: new mongoose.Types.ObjectId(artisanId),
          type: { $in: ['payment', 'payout'] },
          status: { $in: ['success', 'released'] },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          earnings: { $sum: '$artisanAmount' },
          fees: { $sum: '$platformFee' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Review statistics
    const reviews = await Job.find({
      artisanId,
      'review.rating': { $exists: true }
    }).select('review');

    const reviewDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;
    reviews.forEach(job => {
      if (job.review?.rating) {
        reviewDistribution[job.review.rating]++;
        totalRating += job.review.rating;
      }
    });

    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    // Response rate (applications vs jobs viewed - approximate)
    const totalApplications = await Application.countDocuments({ artisanId });

    // Completion rate
    const totalAssigned = await Job.countDocuments({
      artisanId,
      status: { $in: ['in_progress', 'completed', 'cancelled'] }
    });
    const completedAssigned = await Job.countDocuments({
      artisanId,
      status: 'completed'
    });
    const completionRate = totalAssigned > 0
      ? Math.round((completedAssigned / totalAssigned) * 100)
      : 0;

    // Customer retention (repeat customers)
    const customerJobs = await Job.aggregate([
      { $match: { artisanId: new mongoose.Types.ObjectId(artisanId), status: 'completed' } },
      {
        $group: {
          _id: '$customerId',
          jobCount: { $sum: 1 }
        }
      }
    ]);

    const repeatCustomers = customerJobs.filter(c => c.jobCount > 1).length;
    const retentionRate = customerJobs.length > 0
      ? Math.round((repeatCustomers / customerJobs.length) * 100)
      : 0;

    // Wallet summary
    const wallet = await Wallet.findOne({ artisanId });

    res.json({
      success: true,
      data: {
        period,
        jobs: {
          total: jobStats.reduce((sum, s) => sum + s.count, 0),
          byStatus: jobStatusMap,
          completionRate,
          totalAssigned
        },
        earnings: {
          ...earningsData,
          monthlyBreakdown: monthlyEarnings.map(m => ({
            month: `${m._id.year}-${m._id.month.toString().padStart(2, '0')}`,
            earnings: m.earnings,
            fees: m.fees,
            count: m.count
          }))
        },
        reviews: {
          total: reviews.length,
          averageRating,
          distribution: reviewDistribution
        },
        performance: {
          totalApplications,
          completionRate,
          retentionRate,
          repeatCustomers,
          uniqueCustomers: customerJobs.length
        },
        wallet: wallet ? {
          balance: wallet.balance,
          pendingBalance: wallet.pendingBalance,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn,
          availableForWithdrawal: wallet.availableForWithdrawal
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET TOP ARTISANS
// ==========================================
exports.getTopArtisans = async (req, res, next) => {
  try {
    const { limit = 10, period = '30d' } = req.query;

    const now = new Date();
    let startDate;
    switch (period) {
      case '7d': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
      default: startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    const topArtisans = await Job.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$artisanId',
          completedJobs: { $sum: 1 },
          totalEarnings: { $sum: '$budget' },
          avgRating: { $avg: '$review.rating' }
        }
      },
      { $sort: { completedJobs: -1, totalEarnings: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Populate artisan details
    const artisanIds = topArtisans.map(a => a._id);
    const artisans = await User.find({
      _id: { $in: artisanIds }
    }).select('fullName profileImage').lean();

    const artisanMap = {};
    artisans.forEach(a => artisanMap[a._id.toString()] = a);

    const enriched = topArtisans.map(a => ({
      ...a,
      artisan: artisanMap[a._id.toString()] || null
    }));

    res.json({
      success: true,
      data: { topArtisans: enriched }
    });
  } catch (error) {
    next(error);
  }
};