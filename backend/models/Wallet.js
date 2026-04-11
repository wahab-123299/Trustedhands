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
  reason: String, // Failure reason or notes
  failureCode: String, // Paystack error code if failed
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
}, { _id: true }); // Ensure each withdrawal has an ID

const walletSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Artisan ID is required'],
    unique: true,
    index: true
  },
  // Available balance (can be withdrawn)
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative'],
    set: v => Math.round(v * 100) / 100 // Round to 2 decimal places
  },
  // Total lifetime earnings
  totalEarned: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  // Total amount withdrawn to bank
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  // Pending balance (jobs in progress, not yet available)
  pendingBalance: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  // Total amount currently in withdrawal process
  totalPendingWithdrawal: {
    type: Number,
    default: 0,
    min: 0,
    set: v => Math.round(v * 100) / 100
  },
  // Bank account details for transfers
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
    paystackRecipientCode: { type: String, trim: true }, // Cached from Paystack
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },
  // Transaction references (deposits, earnings)
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  // Withdrawal history (embedded subdocuments)
  withdrawalHistory: [withdrawalSchema],
  // Stats
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

// Total available for withdrawal
walletSchema.virtual('availableForWithdrawal').get(function() {
  return Math.max(0, this.balance - this.totalPendingWithdrawal);
});

// Net worth (balance + pending - pending withdrawals)
walletSchema.virtual('netWorth').get(function() {
  return this.balance + this.pendingBalance;
});

// ==========================================
// INSTANCE METHODS
// ==========================================

/**
 * Add earnings to wallet (when job is completed and paid)
 * @param {Number} amount - Amount to add
 * @param {ObjectId} transactionId - Reference to Transaction
 * @param {String} type - 'job_payment' or 'refund'
 */
walletSchema.methods.addEarnings = async function(amount, transactionId, type = 'job_payment') {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  
  this.balance += roundedAmount;
  this.totalEarned += roundedAmount;
  
  if (transactionId) {
    this.transactions.push(transactionId);
  }

  // Update stats
  if (type === 'job_payment') {
    this.stats.totalJobsCompleted += 1;
    // Recalculate average
    const totalValue = this.stats.averageJobValue * (this.stats.totalJobsCompleted - 1) + roundedAmount;
    this.stats.averageJobValue = totalValue / this.stats.totalJobsCompleted;
  }

  return await this.save();
};

/**
 * Move from pending to available (when job is confirmed complete)
 * @param {Number} amount - Amount to move
 */
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

  return await this.save();
};

/**
 * Add to pending balance (when job is booked but not completed)
 * @param {Number} amount - Amount to hold
 */
walletSchema.methods.holdInPending = async function(amount) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  this.pendingBalance += roundedAmount;

  return await this.save();
};

/**
 * Request a withdrawal (creates pending withdrawal, deducts from balance)
 * @param {Number} amount - Amount to withdraw
 * @returns {Object} Withdrawal object and ID
 */
walletSchema.methods.requestWithdrawal = async function(amount) {
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Minimum withdrawal check
  if (roundedAmount < 500) {
    throw new Error('Minimum withdrawal amount is ₦500');
  }

  // Check available balance (balance - pending withdrawals)
  const available = this.balance - this.totalPendingWithdrawal;
  if (roundedAmount > available) {
    throw new Error(`Insufficient available balance. Available: ₦${available.toLocaleString()}, Requested: ₦${roundedAmount.toLocaleString()}`);
  }

  // Check if bank details are set
  if (!this.bankDetails?.accountNumber || !this.bankDetails?.bankCode) {
    throw new Error('Bank account details not configured. Please update your bank details first.');
  }

  // Create withdrawal record
  const withdrawal = {
    amount: roundedAmount,
    status: 'pending',
    requestedAt: new Date()
  };

  this.withdrawalHistory.push(withdrawal);
  this.totalPendingWithdrawal += roundedAmount;
  
  await this.save();

  // Get the created withdrawal (last one)
  const createdWithdrawal = this.withdrawalHistory[this.withdrawalHistory.length - 1];
  
  return {
    withdrawal: createdWithdrawal,
    withdrawalId: createdWithdrawal._id
  };
};

/**
 * Mark withdrawal as processing (when Paystack transfer is initiated)
 * @param {ObjectId} withdrawalId - ID of withdrawal
 * @param {String} paystackReference - Paystack transfer reference
 */
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
  
  return await this.save();
};

/**
 * Complete a withdrawal (when Paystack confirms success)
 * @param {String} paystackReference - Paystack transfer reference
 * @param {String} paystackTransferId - Paystack transfer ID
 */
walletSchema.methods.completeWithdrawal = async function(paystackReference, paystackTransferId) {
  const withdrawal = this.withdrawalHistory.find(
    w => w.paystackTransferReference === paystackReference
  );

  if (!withdrawal) {
    throw new Error('Withdrawal not found with reference: ' + paystackReference);
  }

  if (withdrawal.status === 'completed') {
    return this; // Already completed
  }

  if (withdrawal.status !== 'processing') {
    throw new Error(`Cannot complete withdrawal with status: ${withdrawal.status}`);
  }

  // Update withdrawal
  withdrawal.status = 'completed';
  withdrawal.processedAt = new Date();
  withdrawal.completedAt = new Date();
  withdrawal.paystackTransferId = paystackTransferId;

  // Update wallet totals
  this.totalWithdrawn += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;
  // Balance was already deducted when request was made

  return await this.save();
};

/**
 * Fail a withdrawal (when Paystack reports failure)
 * @param {String} paystackReference - Paystack transfer reference
 * @param {String} reason - Failure reason
 * @param {String} failureCode - Paystack error code
 */
walletSchema.methods.failWithdrawal = async function(paystackReference, reason, failureCode) {
  const withdrawal = this.withdrawalHistory.find(
    w => w.paystackTransferReference === paystackReference
  );

  if (!withdrawal) {
    throw new Error('Withdrawal not found with reference: ' + paystackReference);
  }

  if (withdrawal.status === 'failed') {
    return this; // Already failed
  }

  if (!['pending', 'processing'].includes(withdrawal.status)) {
    throw new Error(`Cannot fail withdrawal with status: ${withdrawal.status}`);
  }

  // Update withdrawal
  withdrawal.status = 'failed';
  withdrawal.reason = reason;
  withdrawal.failureCode = failureCode;
  withdrawal.processedAt = new Date();

  // Refund to balance
  this.balance += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;

  return await this.save();
};

/**
 * Cancel a pending withdrawal (artisan cancels before processing)
 * @param {ObjectId} withdrawalId - ID of withdrawal
 */
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

  // Refund to balance
  this.balance += withdrawal.amount;
  this.totalPendingWithdrawal -= withdrawal.amount;

  return await this.save();
};

/**
 * Update bank details
 * @param {Object} bankDetails - New bank details
 */
walletSchema.methods.updateBankDetails = async function(bankDetails) {
  this.bankDetails = {
    ...this.bankDetails,
    ...bankDetails,
    isVerified: false, // Reset verification on change
    verifiedAt: undefined
  };
  return await this.save();
};

/**
 * Get wallet summary
 */
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

/**
 * Get wallet by artisan ID (with populate)
 */
walletSchema.statics.findByArtisan = function(artisanId) {
  return this.findOne({ artisanId })
    .populate('transactions', 'amount type status createdAt')
    .populate('artisanId', 'fullName email phone');
};

/**
 * Get total platform statistics
 */
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