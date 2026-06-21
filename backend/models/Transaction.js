const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: function() {
      return ['payment', 'payout', 'refund'].includes(this.type);
    }
  },
  payerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return ['payment', 'payout', 'refund'].includes(this.type);
    }
  },
  payeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Payee ID is required']
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative'],
    set: v => Math.round(v * 100) / 100
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
  netAmount: {
    type: Number,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  paystackReference: {
    type: String,
    index: true,
    sparse: true,
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
  paystackTransferCode: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'success', 'failed', 'refunded', 'withdrawn', 'released', 'cancelled', 'reversed'],
      message: 'Invalid transaction status: {VALUE}'
    },
    default: 'pending'
  },
  type: {
    type: String,
    enum: {
      values: ['payment', 'payout', 'refund', 'withdrawal', 'deposit', 'fee', 'adjustment'],
      message: 'Invalid transaction type: {VALUE}'
    },
    required: [true, 'Transaction type is required']
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'ussd', 'wallet', 'qr', 'mobile_money', 'bank_account', 'none'],
    default: 'card'
  },
  currency: {
    type: String,
    enum: ['NGN', 'USD', 'EUR', 'GBP'],
    default: 'NGN'
  },
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
        return JSON.stringify(v).length <= 10000;
      },
      message: 'Metadata too large'
    }
  },
  paidAt: Date,
  processedAt: Date,
  releasedAt: Date,
  failedAt: Date,
  refundedAt: Date,
  cancelledAt: Date,
  failureReason: {
    type: String,
    maxlength: 500
  },
  failureCode: String,
  refundReason: {
    type: String,
    maxlength: 500
  },
  refundAmount: {
    type: Number,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  ipAddress: String,
  deviceInfo: String,
  userAgent: String,
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

transactionSchema.index({ payeeId: 1, status: 1, createdAt: -1 });
transactionSchema.index({ payerId: 1, status: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1, createdAt: -1 });
transactionSchema.index({ jobId: 1, type: 1 });

// ==========================================
// VIRTUALS
// ==========================================

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

const PLATFORM_FEE_PERCENTAGE = 0.10;

transactionSchema.statics.calculatePlatformFee = function(amount) {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE * 100) / 100;
};

transactionSchema.statics.calculateArtisanAmount = function(amount) {
  const fee = this.calculatePlatformFee(amount);
  return Math.round((amount - fee) * 100) / 100;
};

transactionSchema.statics.findByPaystackReference = function(reference) {
  return this.findOne({ paystackReference: reference });
};

transactionSchema.statics.findByTransferReference = function(reference) {
  return this.findOne({ paystackTransferReference: reference });
};

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

transactionSchema.methods.markAsSuccessful = async function(paystackData) {
  this.status = 'success';
  this.paystackTransactionId = paystackData.id?.toString();
  this.paidAt = new Date(paystackData.paid_at || Date.now());
  this.paymentMethod = paystackData.channel || this.paymentMethod;
  
  if (paystackData.amount) {
    const amountInNaira = paystackData.amount / 100;
    if (Math.abs(amountInNaira - this.amount) > 1) {
      console.warn(`Amount mismatch: Expected ${this.amount}, got ${amountInNaira}`);
    }
  }

  return await this.save();
};

transactionSchema.methods.markAsFailed = async function(reason, code) {
  this.status = 'failed';
  this.failureReason = reason;
  this.failureCode = code;
  this.failedAt = new Date();
  return await this.save();
};

transactionSchema.methods.markAsRefunded = async function(refundReason, refundAmount) {
  this.status = 'refunded';
  this.refundReason = refundReason;
  this.refundAmount = refundAmount || this.amount;
  this.refundedAt = new Date();
  return await this.save();
};

transactionSchema.methods.releasePayment = async function() {
  if (this.status !== 'success') {
    throw new Error(`Cannot release payment with status: ${this.status}`);
  }
  
  this.status = 'released';
  this.releasedAt = new Date();
  return await this.save();
};

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

transactionSchema.pre('save', function(next) {
  if (this.isModified('amount') && this.type === 'payment') {
    this.platformFee = this.constructor.calculatePlatformFee(this.amount);
    this.artisanAmount = this.constructor.calculateArtisanAmount(this.amount);
  }
  
  if (this.currency) {
    this.currency = this.currency.toUpperCase();
  }
  
  next();
});

transactionSchema.post('save', async function(doc) {
  if (doc.status === 'success' && doc.type === 'payment') {
    try {
      const Wallet = mongoose.model('Wallet');
      const wallet = await Wallet.findOne({ artisanId: doc.payeeId });
      
      if (wallet) {
        await wallet.holdInPending(doc.artisanAmount);
      }
    } catch (error) {
      console.error('Failed to update wallet after transaction:', error);
    }
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);