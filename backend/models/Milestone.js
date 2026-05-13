const milestoneSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  // Milestone details
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    trim: true
  },
  // Financials
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1000, 'Minimum milestone amount is ₦1,000']
  },
  platformFee: {
    type: Number,
    default: 0
  },
  artisanAmount: {
    type: Number,
    default: 0
  },
  // Due date
  dueDate: {
    type: Date,
    required: true
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'approved', 'revision_requested', 'released', 'disputed'],
    default: 'pending',
    index: true
  },
  // Order in the milestone sequence
  order: {
    type: Number,
    required: true,
    min: 1
  },
  // Completion
  completedAt: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completionNote: {
    type: String,
    maxlength: [1000, 'Completion note cannot exceed 1000 characters']
  },
  // Approval
  approvedAt: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalNote: {
    type: String,
    maxlength: [500, 'Approval note cannot exceed 500 characters']
  },
  // Revision request
  revisionRequest: {
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      maxlength: [1000, 'Reason cannot exceed 1000 characters']
    },
    resolvedAt: Date
  },
  // Evidence/images uploaded by artisan
  deliverables: [{
    url: String,
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Linked transaction (when payment is released)
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

milestoneSchema.index({ jobId: 1, order: 1 });
milestoneSchema.index({ jobId: 1, status: 1 });

// Calculate progress percentage
milestoneSchema.statics.calculateProgress = async function(jobId) {
  const milestones = await this.find({ jobId });
  if (milestones.length === 0) return 0;
  const completed = milestones.filter(m => ['approved', 'released'].includes(m.status)).length;
  return Math.round((completed / milestones.length) * 100);
};

// Get total released amount
milestoneSchema.statics.getTotalReleased = async function(jobId) {
  const result = await this.aggregate([
    { $match: { jobId: new mongoose.Types.ObjectId(jobId), status: 'released' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return result[0]?.total || 0;
};

const Milestone = mongoose.model('Milestone', milestoneSchema);
module.exports = Milestone;