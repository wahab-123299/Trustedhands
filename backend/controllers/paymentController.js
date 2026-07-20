// backend/controllers/paymentController.js
const axios = require('axios');
const crypto = require('crypto');
const { User, Job, Transaction, Wallet, ArtisanProfile } = require('../models');
const { AppError } = require('../utils/errorHandler');
const NotificationService = require('../services/notificationService');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// ==========================================
// FIXED: Centralized idempotent payment completion
// Prevents duplicate processing from verifyPayment + webhook
// ==========================================

const COMPLETED_TRANSACTIONS = new Set(); // In-memory dedup (use Redis in production)

/**
 * Idempotently process a successful payment
 * Safe to call from both verifyPayment and webhook
 */
async function processSuccessfulPayment(transaction, paystackData) {
  const txId = transaction._id.toString();

  // Check 1: Already processed in this process lifetime
  if (COMPLETED_TRANSACTIONS.has(txId)) {
    console.log(`[Payment] Already in memory cache: ${txId}`);
    return { alreadyProcessed: true, source: 'memory' };
  }

  // Check 2: Already marked success in DB
  if (transaction.status === 'success' || transaction.status === 'completed') {
    console.log(`[Payment] Already marked success in DB: ${txId}`);
    COMPLETED_TRANSACTIONS.add(txId);
    return { alreadyProcessed: true, source: 'database' };
  }

  // Atomic update: mark as processing to prevent race conditions
  const updatedTx = await Transaction.findOneAndUpdate(
    { _id: transaction._id, status: { $nin: ['success', 'completed'] } },
    {
      status: 'success',
      paidAt: new Date(paystackData.paid_at || Date.now()),
      paystackTransactionId: paystackData.id,
      paymentMethod: paystackData.channel || 'card',
      metadata: {
        ...transaction.metadata,
        paystackResponse: {
          id: paystackData.id,
          channel: paystackData.channel,
          card_type: paystackData.authorization?.card_type,
          bank: paystackData.authorization?.bank,
          last4: paystackData.authorization?.last4
        }
      }
    },
    { new: true }
  );

  if (!updatedTx) {
    // Another process won the race
    console.log(`[Payment] Race condition lost for: ${txId}`);
    return { alreadyProcessed: true, source: 'race_condition' };
  }

  COMPLETED_TRANSACTIONS.add(txId);

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

  // Notifications
  await sendPaymentNotifications(transaction);

  console.log(`[Payment] Successfully processed: ${txId}`);
  return { alreadyProcessed: false, source: 'fresh' };
}

/**
 * Send notifications for payment received
 */
async function sendPaymentNotifications(transaction) {
  try {
    const [artisan, customer, job] = await Promise.all([
      User.findById(transaction.payeeId),
      User.findById(transaction.payerId),
      Job.findById(transaction.jobId)
    ]);

    if (artisan) {
      await NotificationService.send({
        user: artisan,
        type: 'payment_received',
        channels: ['in_app', 'email'],
        data: {
          amount: transaction.artisanAmount,
          jobTitle: job?.title,
          jobId: transaction.jobId,
          customerName: customer?.fullName
        }
      });
    }

    if (customer) {
      await NotificationService.send({
        user: customer,
        type: 'payment_confirmed',
        channels: ['in_app', 'email'],
        data: {
          amount: transaction.amount,
          jobTitle: job?.title,
          jobId: transaction.jobId
        }
      });
    }
  } catch (e) {
    console.error('[Payment] Notification failed:', e.message);
  }
}

// ==========================================
// PAYMENT INITIALIZATION
// ==========================================

exports.initializePayment = async (req, res, next) => {
  try {
    const { jobId, email, metadata = {} } = req.body;

    if (!jobId) {
      throw new AppError('VALIDATION_ERROR', 'Job ID is required.');
    }

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found.');
    }

    if (job.customerId.toString() !== req.user._id.toString()) {
      throw new AppError('AUTH_UNAUTHORIZED', 'You are not authorized to pay for this job.');
    }

    if (!['pending', 'accepted'].includes(job.status)) {
      throw new AppError('JOB_INVALID_STATUS', `Cannot pay for job with status: ${job.status}.`);
    }

    if (job.paymentStatus !== 'pending') {
      throw new AppError('JOB_INVALID_STATUS', 'Payment has already been processed for this job.');
    }

    if (job.hasMilestones) {
      throw new AppError(
        'JOB_HAS_MILESTONES',
        'This job uses milestone-based payments. Please use the milestone payment endpoints.'
      );
    }

    const artisanProfile = await ArtisanProfile.findOne({ userId: job.artisanId });
    if (!artisanProfile) {
      throw new AppError('ARTISAN_NOT_FOUND', 'Artisan profile not found.');
    }

    const amount = job.budget || artisanProfile.rate?.amount || 0;

    if (amount < 1000) {
      throw new AppError('VALIDATION_ERROR', 'Minimum payment amount is ₦1,000.');
    }

    if (amount > 10000000) {
      throw new AppError('VALIDATION_ERROR', 'Maximum payment amount is ₦10,000,000.');
    }

    // Check for existing pending transaction
    const existingTransaction = await Transaction.findOne({
      jobId,
      status: 'pending',
      type: 'payment'
    });

    if (existingTransaction) {
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

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: email || req.user.email,
        amount: Math.round(amount * 100),
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

    // Find transaction
    let transaction = await Transaction.findOne({ paystackReference: reference });

    // Already processed?
    if (transaction && (transaction.status === 'success' || transaction.status === 'completed')) {
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: { transaction, alreadyProcessed: true }
      });
    }

    // Verify with Paystack
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000
      }
    );

    const { data } = response.data;

    if (data.status !== 'success') {
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

    if (!transaction) {
      throw new AppError('NOT_FOUND', 'Transaction not found for this reference.');
    }

    // FIXED: Use centralized idempotent processor
    const result = await processSuccessfulPayment(transaction, data);

    res.json({
      success: true,
      message: result.alreadyProcessed ? 'Payment already verified' : 'Payment verified successfully',
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
        },
        alreadyProcessed: result.alreadyProcessed
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
// ESCROW RELEASE
// ==========================================

exports.releasePayment = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('JOB_NOT_FOUND', 'Job not found.');
    }

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

    const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
    if (!wallet) {
      throw new AppError('NOT_FOUND', 'Artisan wallet not found.');
    }

    // Release from pending to available
    await wallet.releasePendingBalance(transaction.artisanAmount);

    // Update transaction
    await transaction.releasePayment();

    job.paymentStatus = 'released';
    job.releasedAt = new Date();
    await job.save();

    // Notify artisan
    await notifyArtisanPaymentReleased(req.app.get('io'), transaction, wallet);

    // Notifications
    try {
      const [artisan, customer] = await Promise.all([
        User.findById(transaction.payeeId),
        User.findById(transaction.payerId)
      ]);

      if (artisan) {
        await NotificationService.send({
          user: artisan,
          type: 'payment_released',
          channels: ['in_app', 'email'],
          data: {
            amount: transaction.artisanAmount,
            jobTitle: job.title,
            jobId: job._id,
            walletBalance: wallet.balance
          }
        });
      }
      if (customer) {
        await NotificationService.send({
          user: customer,
          type: 'payment_released_customer',
          channels: ['in_app', 'email'],
          data: {
            amount: transaction.amount,
            jobTitle: job.title,
            jobId: job._id,
            artisanName: artisan?.fullName
          }
        });
      }
    } catch (e) {
      console.error('[releasePayment] Notification failed:', e.message);
    }

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

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({ received: true, error: 'Processing error logged' });
  }
};

// ==========================================
// FIXED: Webhook handlers use centralized processor
// ==========================================

async function handleChargeSuccess(data) {
  const { reference } = data;

  const transaction = await Transaction.findOne({ paystackReference: reference });
  if (!transaction) {
    console.error(`[Webhook] Transaction not found: ${reference}`);
    return;
  }

  // FIXED: Use centralized idempotent processor
  const result = await processSuccessfulPayment(transaction, data);

  if (result.alreadyProcessed) {
    console.log(`[Webhook] Payment already processed (${result.source}): ${reference}`);
    return;
  }

  console.log(`[Webhook] Payment success processed: ${reference}`);
}

async function handleChargeFailed(data) {
  const { reference, gateway_response } = data;

  const transaction = await Transaction.findOne({ paystackReference: reference });
  if (!transaction) return;

  if (transaction.status === 'failed') return;

  await transaction.markAsFailed(gateway_response || 'Payment failed', 'failed');

  await Job.findByIdAndUpdate(transaction.jobId, {
    paymentStatus: 'failed'
  });

  console.log(`[Webhook] Payment failed processed: ${reference}`);
}

async function handleTransferSuccess(data) {
  const { reference, id, amount, recipient } = data;

  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction) {
    console.error(`[Webhook] Withdrawal transaction not found: ${reference}`);
    return;
  }

  if (transaction.status === 'success' || transaction.status === 'completed') {
    console.log(`[Webhook] Withdrawal already completed: ${reference}`);
    return;
  }

  await transaction.markWithdrawalComplete({
    id,
    amount,
    transfer_code: recipient?.transfer_code
  });

  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.completeWithdrawal(reference, id.toString());
  }

  try {
    const artisan = await User.findById(transaction.payeeId);
    if (artisan) {
      await NotificationService.send({
        user: artisan,
        type: 'withdrawal_completed',
        channels: ['in_app', 'email'],
        data: {
          amount: transaction.amount,
          reference: reference,
          bankName: transaction.metadata?.bankName
        }
      });
    }
  } catch (e) {
    console.error('[handleTransferSuccess] Notification failed:', e.message);
  }

  console.log(`[Webhook] Transfer success processed: ${reference}`);
}

async function handleTransferFailed(data) {
  const { reference, reason } = data;

  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction) return;

  if (transaction.status === 'failed') return;

  await transaction.markAsFailed(reason, 'transfer_failed');

  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.failWithdrawal(reference, reason);
  }

  try {
    const artisan = await User.findById(transaction.payeeId);
    if (artisan) {
      await NotificationService.send({
        user: artisan,
        type: 'withdrawal_failed',
        channels: ['in_app', 'email'],
        data: {
          amount: transaction.amount,
          reference: reference,
          reason: reason
        }
      });
    }
  } catch (e) {
    console.error('[handleTransferFailed] Notification failed:', e.message);
  }

  console.log(`[Webhook] Transfer failed processed: ${reference}`);
}

async function handleTransferReversed(data) {
  const { reference, reason } = data;

  const transaction = await Transaction.findOne({ paystackTransferReference: reference });
  if (!transaction || transaction.status === 'reversed') return;

  transaction.status = 'reversed';
  transaction.failureReason = reason;
  await transaction.save();

  const wallet = await Wallet.findOne({ artisanId: transaction.payeeId });
  if (wallet) {
    await wallet.failWithdrawal(reference, `Reversed: ${reason}`);
  }

  try {
    const artisan = await User.findById(transaction.payeeId);
    if (artisan) {
      await NotificationService.send({
        user: artisan,
        type: 'withdrawal_failed',
        channels: ['in_app', 'email'],
        data: {
          amount: transaction.amount,
          reference: reference,
          reason: `Reversed: ${reason}`
        }
      });
    }
  } catch (e) {
    console.error('[handleTransferReversed] Notification failed:', e.message);
  }
}

// ==========================================
// WITHDRAWAL
// ==========================================

exports.requestWithdrawal = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Valid amount is required.');
    }

    const withdrawalAmount = Math.round(parseFloat(amount) * 100) / 100;

    const wallet = await Wallet.findOne({ artisanId: userId });
    if (!wallet) {
      throw new AppError('NOT_FOUND', 'Wallet not found.');
    }

    if (!wallet.bankDetails?.accountNumber || !wallet.bankDetails?.bankCode) {
      throw new AppError('VALIDATION_ERROR', 'Please add your bank details in your profile first.');
    }

    if (withdrawalAmount < 500) {
      throw new AppError('VALIDATION_ERROR', 'Minimum withdrawal amount is ₦500.');
    }

    const availableBalance = wallet.balance - wallet.totalPendingWithdrawal;
    if (withdrawalAmount > availableBalance) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Insufficient available balance. Available: ₦${availableBalance.toLocaleString()}, Requested: ₦${withdrawalAmount.toLocaleString()}`
      );
    }

    const { withdrawalId } = await wallet.requestWithdrawal(withdrawalAmount);

    const transaction = await Transaction.create({
      payeeId: userId,
      payerId: userId,
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

    try {
      const transferData = await initiatePaystackTransfer(
        withdrawalAmount,
        wallet.bankDetails,
        `TrustedHand Withdrawal - ${userId}`
      );

      transaction.paystackTransferReference = transferData.reference;
      transaction.status = 'processing';
      await transaction.save();

      await wallet.processWithdrawal(withdrawalId, transferData.reference);

      try {
        const user = await User.findById(userId);
        await NotificationService.send({
          user: user,
          type: 'withdrawal_initiated',
          channels: ['in_app', 'email'],
          data: {
            amount: withdrawalAmount,
            reference: transferData.reference,
            bankName: wallet.bankDetails.bankName,
            accountNumber: wallet.bankDetails.accountNumber.slice(-4)
          }
        });
      } catch (e) {
        console.error('[requestWithdrawal] Notification failed:', e.message);
      }

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
  if (!bankDetails.bankCode) {
    throw new Error('Bank code is required');
  }

  let recipientCode = bankDetails.paystackRecipientCode;

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
      throw new Error('Failed to verify bank account. Please check your bank details.', { cause: error });
    }
  }

  try {
    const transferResponse = await axios.post(
      `${PAYSTACK_BASE_URL}/transfer`,
      {
        source: 'balance',
        amount: Math.round(amount * 100),
        recipient: recipientCode,
        reason: reason.substring(0, 100),
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

    if (error.response?.data?.message?.includes('insufficient')) {
      throw new Error('Platform temporarily unable to process withdrawals. Please try again later.', { cause: error });
    }

    throw new Error(error.response?.data?.message || 'Failed to initiate bank transfer', { cause: error });
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

exports.getPaymentMethod = getPaymentMethod;

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
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 10000
      }
    );

    if (!response.data?.status) {
      throw new AppError('PAYMENT_FAILED', 'Failed to fetch bank list');
    }

    const banks = response.data.data.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: { banks, count: banks.length }
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

    if (!/^\d{10}$/.test(accountNumber)) {
      throw new AppError('VALIDATION_ERROR', 'Account number must be exactly 10 digits.');
    }

    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
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

    if (error instanceof AppError) return next(error);
    if (error.response?.status === 422) {
      return next(new AppError('VALIDATION_ERROR', 'Invalid account number or bank code. Please verify and try again.'));
    }
    return next(new AppError('VALIDATION_ERROR', 'Could not verify account. Please check your details and try again.'));
  }
};