const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Reference to related entities
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    index: true,
    // Not required for withdrawals or direct transfers
    required: function() {
      return ['payment', 'payout', 'refund'].includes(this.type);
    }
  },
  
  // For payments: customer is payer, artisan is payee
  // For withdrawals: artisan is payer (from wallet), bank is payee
  payerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: function() {
      return ['payment', 'payout', 'refund'].includes(this.type);
    }
  },
  payeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: [true, 'Payee ID is required']
  },
  
  // Reference to wallet (for withdrawals and payouts)
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    index: true
  },

  // Amount breakdown
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  platformFee: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  artisanAmount: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  // For withdrawals: amount after Paystack fees
  netAmount: {
    type: Number,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },

  // Paystack integration fields
  paystackReference: {
    type: String,
    index: true,
    sparse: true, // Allow null but enforce uniqueness when set
    trim: true
  },
  paystackTransactionId: {
    type: String,
    index: true,
    sparse: true,
    trim: true
  },
  paystackTransferReference: {
    type: String,
    index: true,
    sparse: true,
    trim: true
  },
  paystackTransferCode: { // For bulk transfers
    type: String,
    trim: true
  },

  // Transaction status
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'success', 'failed', 'refunded', 'withdrawn', 'released', 'cancelled', 'reversed'],
      message: 'Invalid transaction status: {VALUE}'
    },
    default: 'pending',
    index: true
  },

  // Transaction type
  type: {
    type: String,
    enum: {
      values: ['payment', 'payout', 'refund', 'withdrawal', 'deposit', 'fee', 'adjustment'],
      message: 'Invalid transaction type: {VALUE}'
    },
    required: [true, 'Transaction type is required'],
    index: true
  },

  // Payment method (for customer payments)
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'ussd', 'wallet', 'qr', 'mobile_money', 'bank_account', 'none'],
    default: 'card'
  },

  // Currency (for future multi-currency support)
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'EUR', 'GBP'],
    default: 'NGN'
  },

  // Description and metadata
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(v) {
        return JSON.stringify(v).length <= 10000; // Max 10KB
      },
      message: 'Metadata too large'
    }
  },

  // Timestamps for different stages
  paidAt: Date,           // Customer paid
  processedAt: Date,    // Payment processed to artisan
  releasedAt: Date,     // Escrow released
  failedAt: Date,
  refundedAt: Date,
  cancelledAt: Date,

  // Failure/Refund details
  failureReason: {
    type: String,
    maxlength: 500
  },
  failureCode: String,    // Paystack error code
  refundReason: {
    type: String,
    maxlength: 500
  },
  refundAmount: {
    type: Number,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },

  // IP and device info (for fraud detection)
  ipAddress: String,
  deviceInfo: String,
  userAgent: String,

  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

// Compound indexes for common queries
transactionSchema.index({ payeeId: 1, status: 1, createdAt: -1 }); // Artisan earnings
transactionSchema.index({ payerId: 1, status: 1, createdAt: -1 }); // Customer payments
transactionSchema.index({ type: 1, status: 1, createdAt: -1 }); // Admin reports
transactionSchema.index({ jobId: 1, type: 1 }); // Job-specific transactions

// ==========================================
// VIRTUALS
// ==========================================

// Net amount after all fees
transactionSchema.virtual('netEarnings').get(function() {
  if (this.type === 'payment') {
    return this.artisanAmount;
  }
  if (this.type === 'withdrawal') {
    return this.netAmount || this.amount;
  }
  return this.amount;
});

// ==========================================
// STATIC METHODS
// ==========================================

const PLATFORM_FEE_PERCENTAGE = 0.10; // 10%

/**
 * Calculate platform fee
 */
transactionSchema.statics.calculatePlatformFee = function(amount) {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
};

/**
 * Calculate artisan amount (after platform fee)
 */
transactionSchema.statics.calculateArtisanAmount = function(amount) {
  const fee = this.calculatePlatformFee(amount);
  return Math.round((amount - fee) * 100) / 100;
};

/**
 * Find transaction by Paystack payment reference
 */
transactionSchema.statics.findByPaystackReference = function(reference) {
  return this.findOne({ paystackReference: reference });
};

/**
 * Find transaction by Paystack transfer reference
 */
transactionSchema.statics.findByTransferReference = function(reference) {
  return this.findOne({ paystackTransferReference: reference });
};

/**
 * Get transaction summary for a user
 */
transactionSchema.statics.getUserSummary = async function(userId, options = {}) {
  const matchStage = {
    $or: [{ payerId: userId }, { payeeId: userId }],
    ...(options.startDate && { createdAt: { $gte: options.startDate } }),
    ...(options.endDate && { createdAt: { $lte: options.endDate } })
  };

  const summary = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        }
      }
    }
  ]);

  return summary;
};

/**
 * Get platform revenue report
 */
transactionSchema.statics.getPlatformRevenue = async function(startDate, endDate) {
  const matchStage = {
    type: 'payment',
    status: { $in: ['success', 'released'] },
    createdAt: { $gte: startDate, $lte: endDate }
  };

  const report = await this.aggregate([
    { $match: matchStage },
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

  return report[0] || {
    totalVolume: 0,
    totalFees: 0,
    totalArtisanPayouts: 0,
    transactionCount: 0
  };
};

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Mark transaction as successful (payment received)
 */
transactionSchema.methods.markAsSuccessful = async function(paystackData) {
  this.status = 'success';
  this.paystackTransactionId = paystackData.id?.toString();
  this.paidAt = new Date(paystackData.paid_at || Date.now());
  this.paymentMethod = paystackData.channel || this.paymentMethod;
  
  // Update amounts if provided by Paystack
  if (paystackData.amount) {
    const amountInNaira = paystackData.amount / 100; // Paystack returns in kobo
    if (Math.abs(amountInNaira - this.amount) > 1) {
      console.warn(`Amount mismatch: Expected ${this.amount}, got ${amountInNaira}`);
    }
  }

  return await this.save();
};

/**
 * Mark transaction as failed
 */
transactionSchema.methods.markAsFailed = async function(reason, code) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureCode = code;
  this.failedAt = new Date();
  return await this.save();
};

/**
 * Mark transaction as refunded
 */
transactionSchema.methods.markAsRefunded = async function(refundReason, refundAmount) {
  this.status = 'refunded';
  this.refundReason = refundReason;
  this.refundAmount = refundAmount || this.amount;
  this.refundedAt = new Date();
  return await this.save();
};

/**
 * Release payment from escrow to artisan
 */
transactionSchema.methods.releasePayment = async function() {
  if (this.status !== 'success') {
    throw new Error(`Cannot release payment with status: ${this.status}`);
  }
  
  this.status = 'released';
  this.releasedAt = new Date();
  return await this.save();
};

/**
 * Mark withdrawal as completed
 */
transactionSchema.methods.markWithdrawalComplete = async function(transferData) {
  if (this.type !== 'withdrawal') {
    throw new Error('Can only complete withdrawal transactions');
  }
  
  this.status = 'success';
  this.paystackTransferId = transferData.id?.toString();
  this.paystackTransferCode = transferData.transfer_code;
  this.processedAt = new Date();
  this.netAmount = transferData.amount ? transferData.amount / 100 : this.amount;
  
  return await this.save();
};

// ==========================================
// MIDDLEWARE
// ==========================================

// Pre-save middleware to calculate fees
transactionSchema.pre('save', function(next) {
  // Calculate fees for payment types
  if (this.isModified('amount') && this.type === 'payment') {
    this.platformFee = this.constructor.calculatePlatformFee(this.amount);
    this.artisanAmount = this.constructor.calculateArtisanAmount(this.amount);
  }
  
  // Ensure currency is uppercase
  if (this.currency) {
    this.currency = this.currency.toUpperCase();
  }
  
  next();
});

// Post-save middleware to update wallet (for async operations)
transactionSchema.post('save', async function(doc) {
  // Only process successful payments
  if (doc.status === 'success' && doc.type === 'payment') {
    try {
      const Wallet = mongoose.model('Wallet');
      const wallet = await Wallet.findOne({ artisanId: doc.payeeId });
      
      if (wallet) {
        // Add to pending balance (will be released when job is completed)
        await wallet.holdInPending(doc.artisanAmount);
      }
    } catch (error) {
      console.error('Failed to update wallet after transaction:', error);
      // Don't throw - transaction is already saved
    }
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);