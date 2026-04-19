const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  milestoneIndex: {
    type: Number,
    required: true
  },
  filedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issueType: {
    type: String,
    enum: ['incomplete', 'quality', 'delay', 'no_show', 'other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  desiredOutcome: {
    type: String,
    enum: ['full_refund', 'partial', 'continue'],
    required: true
  },
  partialAmount: {
    type: Number
  },
  evidence: [{
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'mediating', 'resolved', 'appealed'],
    default: 'pending'
  },
  resolution: {
    decision: {
      type: String,
      enum: ['full_refund', 'partial_refund', 'release_to_artisan', 'continue_work']
    },
    amount: Number,
    reason: String,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    decidedAt: Date
  },
  resolutionTime: {
    type: Number,
    default: 72
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

disputeSchema.index({ status: 1, createdAt: 1 });
disputeSchema.index({ jobId: 1, milestoneIndex: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);