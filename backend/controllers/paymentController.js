const axios = require('axios');
const crypto = require('crypto');
const { User, Job, Transaction, Wallet, ArtisanProfile, Conversation } = require('../models');
const { AppError } = require('../utils/errorHandler');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PLATFORM_COMMISSION = 0.10; // 10%

// ==========================================
// PAYMENT INITIALIZATION
// ==========================================

exports.initializePayment = async (req, res, next) => {
  try {
    const { jobId, email, metadata = {} } = req.body;

    if (!jobId) {
      throw new AppError('VALIDATION_ERROR', 'Job ID is required.');
    }

    // Validate job
    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found.');
    }

    // Authorization check
    if (job.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You are not authorized to pay for this job.');
    }

    // Status check
    if (!['pending', 'accepted'].includes(job.status)) {
      throw new AppError('JOB_INVALID_STATUS', `Cannot pay for job with status: ${job.status}.`);
    }

    if (job.paymentStatus !== 'pending') {
      throw new AppError('JOB_INVALID_STATUS', 'Payment has already been processed for this job.');
    }

    // Get artisan profile for rate validation
    const artisanProfile = await ArtisanProfile.findOne({ userId: job.artisanId });
    if (!artisanProfile) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    // Calculate amounts
    const amount = job.budget || artisanProfile.rate?.amount || 0;
    
    if (amount < 1000) {
      throw new AppError('VALIDATION_ERROR', 'Minimum payment amount is ₦1,000.');
    }

    if (amount > 10000000) { // ₦10M max
      throw new AppError('VALIDATION_ERROR', 'Maximum payment amount is ₦10,000,000.');
    }

    // Check for existing pending transaction
    const existingTransaction = await Transaction.findOne({
      jobId,
      status: 'pending',
      type: 'payment'
    });

    if (existingTransaction) {
      // Return existing transaction instead of creating new
      return res.json({
        success: true,
        data: {
          authorization_url: `${PAYSTACK_BASE_URL}/payment/${existingTransaction.paystackReference}`,
          reference: existingTransaction.paystackReference,
          transactionId: existingTransaction._id,
          amount: {
            total: existingTransaction.amount,
            platformFee: existingTransaction.platformFee,
            artisanAmount: existingTransaction.artisanAmount
          },
          message: 'Existing payment session found'
        }
      });
    }

    // Create transaction record
    const transaction = await Transaction.create({
      jobId,
      payerId: req.user._id,
      payeeId: job.artisanId,
      amount,
      type: 'payment',
      status: 'pending',
      description: `Payment for job: ${job.title}`,
      metadata: {
        ...metadata,
        jobTitle: job.title,
        artisanName: artisanProfile.userId?.fullName
      }
    });

    // Initialize Paystack transaction
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: email || req.user.email,
        amount: Math.round(amount * 100), // Paystack expects amount in kobo
        reference: `TH_${transaction._id}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
        metadata: {
          jobId: jobId.toString(),
          transactionId: transaction._id.toString(),
          customerId: req.user._id.toString(),
          artisanId: job.artisanId.toString(),
          artisanAmount: transaction.artisanAmount
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const { data } = response.data;

    // Update transaction with Paystack reference
    transaction.paystackReference = data.reference;
    await transaction.save();

    res.json({
      success: true,
      data: {
        authorization_url: data.authorization_url,
        reference: data.reference,
        access_code: data.access_code,
        transactionId: transaction._id,
        amount: {
          total: transaction.amount,
          platformFee: transaction.platformFee,
          artisanAmount: transaction.artisanAmount
        }
      }
    });
  } catch (error) {
    // Handle Paystack specific errors
    if (error.response?.data?.message) {
      return next(new AppError('PAYMENT_FAILED', error.response.data.message));
    }
    next(error);
  }
};

// ==========================================
// PAYMENT VERIFICATION
// ==========================================

exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      throw new AppError('VALIDATION_ERROR', 'Payment reference is required.');
    }

    // Find transaction first
    let transaction = await Transaction.findOne({ paystackReference: reference });
    
    // If already processed, return cached result
    if (transaction && transaction.status === 'success') {
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: { transaction }
      });
    }

    // Verify with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        },
        timeout: 10000 // 10 second timeout
      }
    );

    const { data } = response.data;

    if (data.status !== 'success') {
      // Update transaction as failed
      if (transaction) {
        await transaction.markAsFailed(
          data.gateway_response || 'Payment failed',
          data.status
        );
      }

      throw new AppError(
        'PAYMENT_FAILED',
        data.gateway_response || `Payment verification failed with status: ${data.status}`
      );
    }

    // Update transaction as successful
    if (!transaction) {
      // Webhook might have created it, or it's a different reference
      throw new AppError('NOT_FOUND', 'Transaction not found for this reference.');
    }

    await transaction.markAsSuccessful({
      id: data.id,
      paid_at: data.paid_at,
      channel: data.channel,
      amount: data.amount
    });

    // Update job payment status
    await Job.findByIdAndUpdate(transaction.jobId, {
      paymentStatus: 'paid',
      transactionId: transaction._id,
      status: 'accepted',
      acceptedAt: new Date()
    });

    // Credit artisan wallet with pending balance (escrow)
    const wallet = await Wallet.findOneAndUpdate(
      { artisanId: transaction.payeeId },
      {
        $inc: { pendingBalance: transaction.artisanAmount },
        $push: { transactions: transaction._id }
      },
      { upsert: true, new: true }
    );

    // Notify artisan via socket and create conversation if needed
    await notifyArtisanPaymentReceived(req.app.get('io'), transaction, wallet);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transaction: await Transaction.findById(transaction._id)
          .populate('jobId', 'title status')
          .populate('payerId', 'fullName profileImage'),
        paystackData: {
          id: data.id,
          status: data.status,
          amount: data.amount / 100,
          channel: data.channel,
          paid_at: data.paid_at
        }
      }
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return next(new AppError('NOT_FOUND', 'Payment reference not found on Paystack.'));
    }
    next(error);
  }
};

// ==========================================
// ESCROW RELEASE (Customer confirms job completion)
// ==========================================

exports.releasePayment = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found.');
    }

    // Only customer can release payment
    if (job.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('AUTH_UNAUTHORIZED', 'Only the customer can release payment.');
    }

    if (job.status !== 'completed') {
      throw new AppError('JOB_INVALID_STATUS', 'Job must be marked as completed by artisan before releasing payment.');
    }

    if (job.paymentStatus !== 'paid') {
      throw new AppError('JOB_INVALID_STATUS', 'Payment has already been released or was not made.');
    }

    const transaction = await Transaction.findOne({ jobId, type: 'payment' });
    if (!transaction) {
      throw new AppError('NOT_FOUND', 'Transaction not found.');
    }

    if (transaction.status !== 'success') {
      throw new AppError('PAYMENT_ERROR', 'Payment was not successful.');
    }

    // CRITICAL: Use wallet methods for proper balance management
    const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
    if (!wallet) {
      throw new AppError('NOT_FOUND', 'Artisan wallet not found.');
    }

    // Release from pending to available
    await wallet.releasePendingBalance(transaction.artisanAmount);

    // Update transaction status
    await transaction.releasePayment();

    // Update job
    job.paymentStatus = 'released';
    job.releasedAt = new Date();
    await job.save();

    // Notify artisan
    await notifyArtisanPaymentReleased(req.app.get('io'), transaction, wallet);

    res.json({
      success: true,
      message: 'Payment released successfully. Funds are now available in artisan wallet.',
      data: { 
        transaction: await Transaction.findById(transaction._id)
          .populate('jobId', 'title')
          .populate('payerId', 'fullName'),
        wallet: {
          balance: wallet.balance,
          availableForWithdrawal: wallet.availableForWithdrawal
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PAYSTACK WEBHOOK HANDLER
// ==========================================

exports.webhook = async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      console.error('Webhook: Missing signature');
      return res.status(400).send('Missing signature');
    }

    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      console.error('Webhook: Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    console.log(`Webhook received: ${event.event}`, { reference: event.data?.reference });

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;
      
      case 'charge.failed':
        await handleChargeFailed(event.data);
        break;
      
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;
      
      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;
      
      case 'transfer.reversed':
        await handleTransferReversed(event.data);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    // Always return 200 to prevent retries
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent Paystack retries
    res.status(200).json({ received: true, error: 'Processing error logged' });
  }
};

// ==========================================
// WEBHOOK HANDLER FUNCTIONS
// ==========================================

async function handleChargeSuccess(data) {
  const { reference, status, id, amount, paid_at, channel } = data;

  const transaction = await Transaction.findOne({ paystackReference: reference });
  if (!transaction) {
    console.error(`Transaction not found for reference: ${reference}`);
    return;
  }

  if (transaction.status === 'success') {
    console.log(`Transaction ${transaction._id} already marked as success`);
    return;
  }

  // Update transaction
  await transaction.markAsSuccessful({
    id,
    paid_at,
    channel,
    amount
  });

  // Update job
  await Job.findByIdAndUpdate(transaction.jobId, {
    paymentStatus: 'paid',
    transactionId: transaction._id,
    status: 'accepted',
    acceptedAt: new Date()
  });

  // Credit artisan wallet (pending/escrow)
  await Wallet.findOneAndUpdate(
    { artisanId: transaction.payeeId },
    {
      $inc: { pendingBalance: transaction.artisanAmount },
      $push: { transactions: transaction._id }
    },
    { upsert: true }
  );

  console.log(`Payment success processed: ${reference}`);
}

async function handleChargeFailed(data) {
  const { reference, gateway_response } = data;

  const transaction = await Transaction.findOne({ paystackReference: reference });
  if (!transaction) return;

  await transaction.markAsFailed(gateway_response || 'Payment failed', 'failed');

  // Update job if needed
  await Job.findByIdAndUpdate(transaction.jobId, {
    paymentStatus: 'failed'
  });

  console.log(`Payment failed processed: ${reference}`);
}

async function handleTransferSuccess(data) {
  const { reference, id, amount, recipient } = data;

  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction) {
    console.error(`Withdrawal transaction not found: ${reference}`);
    return;
  }

  if (transaction.status === 'success') {
    console.log(`Withdrawal ${transaction._id} already completed`);
    return;
  }

  // Update transaction
  await transaction.markWithdrawalComplete({
    id,
    amount,
    transfer_code: recipient?.transfer_code
  });

  // Update wallet using reference (not index)
  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.completeWithdrawal(reference, id.toString());
  }

  console.log(`Transfer success processed: ${reference}`);
}

async function handleTransferFailed(data) {
  const { reference, reason } = data;

  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction) return;

  if (transaction.status === 'failed') return;

  // Update transaction
  await transaction.markAsFailed(reason, 'transfer_failed');

  // Refund wallet
  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.failWithdrawal(reference, reason);
  }

  console.log(`Transfer failed processed: ${reference}, reason: ${reason}`);
}

async function handleTransferReversed(data) {
  const { reference, reason } = data;
  
  console.log(`Transfer reversed: ${reference}, reason: ${reason}`);
  
  // Similar to failed - refund the wallet
  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction || transaction.status === 'reversed') return;

  transaction.status = 'reversed';
  transaction.failureReason = reason;
  await transaction.save();

  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.failWithdrawal(reference, `Reversed: ${reason}`);
  }
}

// ==========================================
// WITHDRAWAL (Artisan)
// ==========================================

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    // Validation
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Valid amount is required.');
    }

    const withdrawalAmount = Math.round(parseFloat(amount) * 100) / 100;

    // Get wallet
    const wallet = await Wallet.findOne({ artisanId: userId });
    if (!wallet) {
      throw new AppError('NOT_FOUND', 'Wallet not found.');
    }

    // Check bank details
    if (!wallet.bankDetails?.accountNumber || !wallet.bankDetails?.bankCode) {
      throw new AppError('VALIDATION_ERROR', 'Please add your bank details in your profile first.');
    }

    // Check minimum withdrawal (₦500)
    if (withdrawalAmount < 500) {
      throw new AppError('VALIDATION_ERROR', 'Minimum withdrawal amount is ₦500.');
    }

    // Check available balance (balance - pending withdrawals)
    const availableBalance = wallet.balance - wallet.totalPendingWithdrawal;
    if (withdrawalAmount > availableBalance) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Insufficient available balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${withdrawalAmount.toLocaleString()}`
      );
    }

    // Create withdrawal request in wallet (this deducts from available balance)
    const { withdrawal, withdrawalId } = await wallet.requestWithdrawal(withdrawalAmount);

    // Create transaction record
    const transaction = await Transaction.create({
      payeeId: userId,
      payerId: userId, // Self-transfer
      walletId: wallet._id,
      amount: withdrawalAmount,
      type: 'withdrawal',
      status: 'pending',
      description: 'Withdrawal to bank account',
      metadata: {
        withdrawalId: withdrawalId.toString(),
        bankName: wallet.bankDetails.bankName,
        accountNumber: wallet.bankDetails.accountNumber
      }
    });

    // Initiate Paystack transfer
    try {
      const transferData = await initiatePaystackTransfer(
        withdrawalAmount,
        wallet.bankDetails,
        `TrustedHand Withdrawal - ${userId}`
      );

      // Update transaction
      transaction.paystackTransferReference = transferData.reference;
      transaction.status = 'processing';
      await transaction.save();

      // Update withdrawal in wallet
      await wallet.processWithdrawal(withdrawalId, transferData.reference);

      res.json({
        success: true,
        message: 'Withdrawal request submitted successfully. Funds will be transferred within 24 hours.',
        data: {
          transaction: await Transaction.findById(transaction._id),
          withdrawal: {
            id: withdrawalId,
            amount: withdrawalAmount,
            status: 'processing',
            reference: transferData.reference
          },
          wallet: {
            balance: wallet.balance,
            availableForWithdrawal: wallet.availableForWithdrawal,
            totalPendingWithdrawal: wallet.totalPendingWithdrawal
          }
        }
      });
    } catch (transferError) {
      // Rollback: Cancel withdrawal and refund
      await wallet.cancelWithdrawal(withdrawalId);
      
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'failed',
        failureReason: transferError.message,
        failedAt: new Date()
      });

      throw new AppError(
        'PAYMENT_FAILED',
        `Failed to initiate withdrawal: ${transferError.message}. Please try again later.`
      );
    }
  } catch (error) {
    next(error);
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function initiatePaystackTransfer(amount, bankDetails, reason) {
  // Validate bank details
  if (!bankDetails.bankCode) {
    throw new Error('Bank code is required');
  }

  let recipientCode = bankDetails.paystackRecipientCode;

  // Create recipient if not cached
  if (!recipientCode) {
    try {
      const recipientResponse = await axios.post(
        `${PAYSTACK_BASE_URL}/transferrecipient`,
        {
          type: 'nuban',
          name: bankDetails.accountName,
          account_number: bankDetails.accountNumber,
          bank_code: bankDetails.bankCode,
          currency: 'NGN'
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!recipientResponse.data?.status) {
        throw new Error(recipientResponse.data?.message || 'Failed to create transfer recipient');
      }

      recipientCode = recipientResponse.data.data.recipient_code;

      // Cache recipient code
      await Wallet.findOneAndUpdate(
        { 'bankDetails.accountNumber': bankDetails.accountNumber },
        { 
          'bankDetails.paystackRecipientCode': recipientCode,
          'bankDetails.isVerified': true,
          'bankDetails.verifiedAt': new Date()
        }
      );
    } catch (error) {
      console.error('Recipient creation error:', error.response?.data || error.message);
      throw new Error('Failed to verify bank account. Please check your bank details.');
    }
  }

  // Initiate transfer
  try {
    const transferResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: 'balance',
        amount: Math.round(amount * 100), // Convert to kobo
        recipient: recipientCode,
        reason: reason.substring(0, 100), // Paystack limit
        reference: `TH_WD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!transferResponse.data?.status) {
      throw new Error(transferResponse.data?.message || 'Transfer initiation failed');
    }

    return {
      reference: transferResponse.data.data.reference,
      transfer_code: transferResponse.data.data.transfer_code,
      id: transferResponse.data.data.id
    };
  } catch (error) {
    console.error('Transfer initiation error:', error.response?.data || error.message);
    
    // Check for specific Paystack errors
    if (error.response?.data?.message?.includes('insufficient')) {
      throw new Error('Platform temporarily unable to process withdrawals. Please try again later.');
    }
    
    throw new Error(error.response?.data?.message || 'Failed to initiate bank transfer');
  }
}

async function notifyArtisanPaymentReceived(io, transaction, wallet) {
  try {
    const artisan = await User.findById(transaction.payeeId);
    if (!artisan) return;

    // Socket notification
    if (artisan.socketId && io) {
      io.to(artisan.socketId).emit('payment_received', {
        transactionId: transaction._id,
        amount: transaction.artisanAmount,
        jobId: transaction.jobId,
        message: `New payment of ₦${transaction.artisanAmount.toLocaleString()} received (held in escrow)`
      });
    }

    // Create or update conversation
    const conversation = await Conversation.findOneAndUpdate(
      {
        participants: { $all: [transaction.payerId, transaction.payeeId] },
        jobId: transaction.jobId
      },
      {
        $set: {
          lastMessage: {
            content: `Payment of ₦${transaction.amount.toLocaleString()} received and held in escrow.`,
            senderId: transaction.payerId,
            createdAt: new Date(),
            type: 'system'
          }
        },
        $inc: { [`unreadCount.${transaction.payeeId}`]: 1 }
      },
      { upsert: true, new: true }
    );

    // Emit to conversation room
    if (io) {
      io.to(`conversation_${conversation._id}`).emit('system_message', {
        conversationId: conversation._id,
        message: 'Payment received and held in escrow'
      });
    }
  } catch (error) {
    console.error('Failed to notify artisan:', error);
    // Don't throw - notification failure shouldn't break payment flow
  }
}

async function notifyArtisanPaymentReleased(io, transaction, wallet) {
  try {
    const artisan = await User.findById(transaction.payeeId);
    if (!artisan) return;

    if (artisan.socketId && io) {
      io.to(artisan.socketId).emit('payment_released', {
        transactionId: transaction._id,
        amount: transaction.artisanAmount,
        jobId: transaction.jobId,
        availableBalance: wallet.balance,
        message: `₦${transaction.artisanAmount.toLocaleString()} released to your wallet and available for withdrawal`
      });
    }
  } catch (error) {
    console.error('Failed to notify artisan of release:', error);
  }
}

function getPaymentMethod(channel) {
  const methodMap = {
    'card': 'card',
    'bank': 'bank_transfer',
    'ussd': 'ussd',
    'qr': 'qr',
    'mobile_money': 'mobile_money',
    'bank_transfer': 'bank_transfer',
    'eft': 'bank_transfer'
  };
  return methodMap[channel] || 'card';
}

// ==========================================
// ADDITIONAL ENDPOINTS
// ==========================================

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, status, startDate, endDate } = req.query;
    const userId = req.user._id;

    const query = {
      $or: [{ payerId: userId }, { payeeId: userId }]
    };

    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .populate('payerId', 'fullName profileImage')
      .populate('payeeId', 'fullName profileImage')
      .populate('jobId', 'title status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    // Calculate summary
    const summary = await Transaction.aggregate([
      {
        $match: {
          $or: [{ payerId: userId }, { payeeId: userId }],
          status: { $in: ['success', 'released', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPaid: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$payerId', userId] }, { $eq: ['$type', 'payment'] }] },
                '$amount',
                0
              ]
            }
          },
          totalEarned: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$payeeId', userId] }, { $in: ['$type', ['payment', 'payout']] }] },
                '$artisanAmount',
                0
              ]
            }
          },
          totalWithdrawn: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$payeeId', userId] }, { $eq: ['$type', 'withdrawal'] }] },
                '$amount',
                0
              ]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        summary: summary[0] || { totalPaid: 0, totalEarned: 0, totalWithdrawn: 0 },
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

exports.getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ artisanId: req.user._id })
      .populate({
        path: 'transactions',
        options: { 
          sort: { createdAt: -1 }, 
          limit: 10 
        },
        select: 'amount type status createdAt description'
      });

    if (!wallet) {
      const newWallet = await Wallet.create({
        artisanId: req.user._id,
        balance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        totalPendingWithdrawal: 0
      });
      
      return res.json({
        success: true,
        data: { 
          wallet: newWallet.getSummary(),
          isNew: true
        }
      });
    }

    res.json({
      success: true,
      data: { 
        wallet: wallet.getSummary(),
        isNew: false
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getBanks = async (req, res, next) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank?country=nigeria`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        },
        timeout: 10000
      }
    );

    if (!response.data?.status) {
      throw new AppError('PAYMENT_FAILED', 'Failed to fetch bank list');
    }

    // Sort banks alphabetically
    const banks = response.data.data.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: { 
        banks,
        count: banks.length
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyAccount = async (req, res, next) => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      throw new AppError('VALIDATION_ERROR', 'Account number and bank code are required.');
    }

    // Validate account number format
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new AppError('VALIDATION_ERROR', 'Account number must be exactly 10 digits.');
    }

    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        },
        timeout: 10000
      }
    );

    if (!response.data?.status) {
      throw new AppError('VALIDATION_ERROR', response.data?.message || 'Account verification failed');
    }

    res.json({
      success: true,
      data: {
        accountNumber: response.data.data.account_number,
        accountName: response.data.data.account_name,
        bankCode: bankCode
      }
    });
  } catch (error) {
    console.error('Account verification error:', error.response?.data || error.message);
    
    if (error.response?.status === 422) {
      throw new AppError('VALIDATION_ERROR', 'Invalid account number or bank code. Please verify and try again.');
    }
    
    throw new AppError('VALIDATION_ERROR', 'Could not verify account. Please check your details and try again.');
  }
};