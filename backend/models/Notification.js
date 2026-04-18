const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'welcome',
      'new_booking',
      'booking_confirmed',
      'booking_declined',
      'job_assigned',
      'new_job_alert',
      'job_started',
      'job_completed',
      'payment_received',
      'review_received',
      'application_received',
      'application_accepted',
      'application_rejected'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    artisanId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    extra: mongoose.Schema.Types.Mixed
  },
  channels: [{
    type: String,
    enum: ['in_app', 'email', 'sms', 'push']
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  readAt: Date
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);