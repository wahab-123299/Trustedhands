const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: [100, 'Minimum withdrawal is ₦100']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paystackTransferReference: String,
  paystackTransferId: String,
  reason: String,
  failureCode: String,
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  completedAt: Date,
  metadata: {
    type: Map,
    of: String
  }
}, { _id: true });

const walletSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Artisan ID is required'],
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative'],
    set: v => Math.round(v * 100) / 100
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  totalPendingWithdrawal: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  bankDetails: {
    bankName: { type: String, trim: true },
    accountNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: 'Account number must be 10 digits'
      }
    },
    accountName: { type: String, trim: true },
    bankCode: { type: String, trim: true },
    paystackRecipientCode: { type: String, trim: true },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },
  // FIXED: Removed invalid enum, added transactionType field if needed
  transactions: [{
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    }
  }],
  withdrawalHistory: [withdrawalSchema],
  stats: {
    totalJobsCompleted: { type: Number, default: 0 },
    totalCustomersServed: { type: Number, default: 0 },
    averageJobValue: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

walletSchema.index({ artisanId: 1 });
walletSchema.index({ 'bankDetails.paystackRecipientCode': 1 });
walletSchema.index({ 'withdrawalHistory.status': 1, 'withdrawalHistory.requestedAt': -1 });

// ==========================================
// VIRTUALS
// ==========================================

walletSchema.virtual('availableForWithdrawal').get(function() {
  return Math.max(0, this.balance - this.totalPendingWithdrawal);
});

walletSchema.virtual('netWorth').get(function() {
  return this.balance + this.pendingBalance;
});

// ==========================================
// INSTANCE METHODS
// ==========================================

walletSchema.methods.addEarnings = async function(amount, transactionId, type = 'job_payment') {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  
  this.balance += roundedAmount;
  this.totalEarned += roundedAmount;
  
  if (transactionId) {
    this.transactions.push({
      transaction: transactionId,
      type: 'credit'  // Earnings are credits
    });
  }

  if (type === 'job_payment') {
    this.stats.totalJobsCompleted += 1;
    const totalValue = this.stats.averageJobValue * (this.stats.totalJobsCompleted - 1) + roundedAmount;
    this.stats.averageJobValue = totalValue / this.stats.totalJobsCompleted;
  }

  return this.save();  // Returns promise
};

walletSchema.methods.releasePendingBalance = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  
  if (roundedAmount > this.pendingBalance) {
    throw new Error('Insufficient pending balance');
  }

  this.pendingBalance -= roundedAmount;
  this.balance += roundedAmount;

  return this.save();
};

walletSchema.methods.holdInPending = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  this.pendingBalance += roundedAmount;

  return this.save();
};

walletSchema.methods.requestWithdrawal = async function(amount) {
  const roundedAmount = Math.round(amount * 100) / 100;
  
  if (roundedAmount < 500) {
    throw new Error('Minimum withdrawal amount is ₦500');
  }

  const available = this.balance - this.totalPendingWithdrawal;
  if (roundedAmount > available) {
    throw new Error(`Insufficient available balance. Available: ₦${available.toLocaleString()}, Requested: ₦${roundedAmount.toLocaleString()}`);
  }

  if (!this.bankDetails?.accountNumber || !this.bankDetails?.bankCode) {
    throw new Error('Bank account details not configured. Please update your bank details first.');
  }

  const withdrawal = {
    amount: roundedAmount,
    status: 'pending',
    requestedAt: new Date()
  };

  this.withdrawalHistory.push(withdrawal);
  this.totalPendingWithdrawal += roundedAmount;
  
  await this.save();

  const createdWithdrawal = this.withdrawalHistory[this.withdrawalHistory.length - 1];
  
  return {
    withdrawal: createdWithdrawal,
    withdrawalId: createdWithdrawal._id
  };
};

walletSchema.methods.processWithdrawal = async function(withdrawalId, paystackReference) {
  const withdrawal = this.withdrawalHistory.id(withdrawalId);
  
  if (!withdrawal) {
    throw new Error('Withdrawal not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new Error(`Cannot process withdrawal with status: ${withdrawal.status}`);
  }

  withdrawal.status = 'processing';
  withdrawal.paystackTransferReference = paystackReference;
  
  return this.save();
};

walletSchema.methods.completeWithdrawal = async function(paystackReference, paystackTransferId) {
  const withdrawal = this.withdrawalHistory.find(
    w => w.paystackTransferReference === paystackReference
  );

  if (!withdrawal) {
    throw new Error('Withdrawal not found with reference: ' + paystackReference);
  }

  if (withdrawal.status === 'completed') {
    return this;
  }

  if (withdrawal.status !== 'processing') {
    throw new Error(`Cannot complete withdrawal with status: ${withdrawal.status}`);
  }

  withdrawal.status = 'completed';
  withdrawal.processedAt = new Date();
  withdrawal.completedAt = new Date();
  withdrawal.paystackTransferId = paystackTransferId;

  this.totalWithdrawn += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;

  return this.save();
};

walletSchema.methods.failWithdrawal = async function(paystackReference, reason, failureCode) {
  const withdrawal = this.withdrawalHistory.find(
    w => w.paystackTransferReference === paystackReference
  );

  if (!withdrawal) {
    throw new Error('Withdrawal not found with reference: ' + paystackReference);
  }

  if (withdrawal.status === 'failed') {
    return this;
  }

  if (!['pending', 'processing'].includes(withdrawal.status)) {
    throw new Error(`Cannot fail withdrawal with status: ${withdrawal.status}`);
  }

  withdrawal.status = 'failed';
  withdrawal.reason = reason;
  withdrawal.failureCode = failureCode;
  withdrawal.processedAt = new Date();

  this.balance += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;

  return this.save();
};

walletSchema.methods.cancelWithdrawal = async function(withdrawalId) {
  const withdrawal = this.withdrawalHistory.id(withdrawalId);
  
  if (!withdrawal) {
    throw new Error('Withdrawal not found');
  }

  if (withdrawal.status !== 'pending') {
    throw new Error(`Cannot cancel withdrawal with status: ${withdrawal.status}`);
  }

  withdrawal.status = 'cancelled';
  withdrawal.processedAt = new Date();

  this.balance += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;

  return this.save();
};

// FIXED: Added validation and proper merging
walletSchema.methods.updateBankDetails = async function(bankDetails) {
  // Validate required fields if provided
  if (bankDetails.accountNumber && !/^\d{10}$/.test(bankDetails.accountNumber)) {
    throw new Error('Account number must be 10 digits');
  }
  
  this.bankDetails = {
    ...this.bankDetails?.toObject?.() || this.bankDetails || {},
    ...bankDetails,
    isVerified: false,
    verifiedAt: undefined
  };
  
  return this.save();
};

walletSchema.methods.getSummary = function() {
  return {
    balance: this.balance,
    pendingBalance: this.pendingBalance,
    totalEarned: this.totalEarned,
    totalWithdrawn: this.totalWithdrawn,
    totalPendingWithdrawal: this.totalPendingWithdrawal,
    availableForWithdrawal: this.availableForWithdrawal,
    netWorth: this.netWorth,
    bankDetails: {
      bankName: this.bankDetails?.bankName,
      accountNumber: this.bankDetails?.accountNumber ? 
        `****${this.bankDetails.accountNumber.slice(-4)}` : null,
      accountName: this.bankDetails?.accountName,
      isVerified: this.bankDetails?.isVerified
    },
    stats: this.stats,
    recentWithdrawals: this.withdrawalHistory
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, 5)
  };
};

// ==========================================
// STATIC METHODS
// ==========================================

walletSchema.statics.findByArtisan = function(artisanId) {
  return this.findOne({ artisanId })
    .populate('transactions.transaction', 'amount type status createdAt')  // FIXED: populate path
    .populate('artisanId', 'fullName email phone');
};

walletSchema.statics.getPlatformStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalPending: { $sum: '$pendingBalance' },
        totalEarned: { $sum: '$totalEarned' },
        totalWithdrawn: { $sum: '$totalWithdrawn' },
        totalArtisans: { $sum: 1 }
      }
    }
  ]);

  return stats[0] || {
    totalBalance: 0,
    totalPending: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    totalArtisans: 0
  };
};

module.exports = mongoose.model('Wallet', walletSchema);