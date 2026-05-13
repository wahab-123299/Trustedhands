const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: [true, 'Job ID is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Milestone amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  percentOfTotal: {
    type: Number,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'approved', 'disputed', 'cancelled'],
    default: 'pending'
  },
  dueDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    url: {
      type: String,
      required: true
    },
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notes: [{
    text: {
      type: String,
      required: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

milestoneSchema.index({ jobId: 1, status: 1 });
milestoneSchema.index({ jobId: 1, order: 1 });
milestoneSchema.index({ createdBy: 1 });

milestoneSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || ['completed', 'approved', 'cancelled'].includes(this.status)) {
    return false;
  }
  return new Date() > this.dueDate;
});

milestoneSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate || ['completed', 'approved', 'cancelled'].includes(this.status)) {
    return null;
  }
  const diff = this.dueDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

milestoneSchema.methods.complete = async function(userId) {
  if (this.status === 'completed' || this.status === 'approved') {
    throw new Error('Milestone is already completed');
  }
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedBy = userId;
  return await this.save();
};

milestoneSchema.methods.approve = async function(userId) {
  if (this.status !== 'completed') {
    throw new Error('Milestone must be completed before approval');
  }
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = userId;
  return await this.save();
};

milestoneSchema.methods.dispute = async function(reason) {
  if (this.status === 'approved' || this.status === 'cancelled') {
    throw new Error('Cannot dispute an approved or cancelled milestone');
  }
  this.status = 'disputed';
  this.notes.push({
    text: `Dispute filed: ${reason}`,
    createdBy: this.jobId
  });
  return await this.save();
};

milestoneSchema.methods.addNote = async function(text, userId) {
  this.notes.push({ text, createdBy: userId });
  return await this.save();
};

milestoneSchema.methods.addAttachment = async function(url, filename, userId) {
  this.attachments.push({ url, filename, uploadedBy: userId });
  return await this.save();
};

milestoneSchema.pre('save', function(next) {
  if (this.title) this.title = this.title.trim();
  if (this.description) this.description = this.description.trim();
  next();
});

const Milestone = mongoose.model('Milestone', milestoneSchema);

module.exports = Milestone;