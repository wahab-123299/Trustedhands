const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer ID is required'],
    index: true
  },
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,  // ← CHANGED: Made optional since job is posted before artisan is assigned
    default: null
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    // Removed strict enum to allow custom categories
    validate: {
      validator: function(v) {
        return v && v.length >= 2 && v.length <= 50;
      },
      message: 'Category must be 2-50 characters'
    }
  },
  location: {
    state: {
      type: String,
      required: [true, 'State is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    address: {
      type: String,
      trim: true
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: [1000, 'Minimum budget is ₦1,000']
  },
  budgetType: {
    type: String,
    enum: ['Fixed', 'Negotiable'],
    default: 'Fixed'
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'released', 'refunded'],
    default: 'pending'
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  applications: [{
    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    message: {
      type: String,
      maxlength: [500, 'Application message cannot exceed 500 characters']
    },
    proposedAmount: {
      type: Number,
      min: [1000, 'Proposed amount must be at least ₦1,000']
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  disputeReason: {
    type: String,
    maxlength: [1000, 'Dispute reason cannot exceed 1000 characters']
  },
  disputeRaisedAt: Date,
  disputeResolvedAt: Date,
  disputeResolution: String,
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters']
    },
    createdAt: Date
  },
  customerConfirmed: {
    type: Boolean,
    default: false
  },
  customerConfirmedAt: Date,
  artisanConfirmed: {
    type: Boolean,
    default: false
  },
  artisanConfirmedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes - OPTIMIZED
jobSchema.index({ customerId: 1, status: 1 });
jobSchema.index({ artisanId: 1, status: 1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ category: 1, status: 1 });
jobSchema.index({ 'location.state': 1, 'location.city': 1, status: 1 });
jobSchema.index({ budget: 1, status: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ scheduledDate: 1 });

// Virtual for job duration in hours
jobSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.round((this.completedAt - this.startedAt) / (1000 * 60 * 60));
  }
  return null;
});

// Virtual for application count
jobSchema.virtual('applicationCount').get(function() {
  return this.applications?.length || 0;
});

// Virtual for confirmation status
jobSchema.virtual('confirmationStatus').get(function() {
  if (this.customerConfirmed && this.artisanConfirmed) return 'both_confirmed';
  if (this.customerConfirmed) return 'customer_confirmed';
  if (this.artisanConfirmed) return 'artisan_confirmed';
  return 'pending_confirmation';
});

// Method to check if job can be cancelled
jobSchema.methods.canBeCancelled = function() {
  return ['pending', 'accepted'].includes(this.status) && this.paymentStatus !== 'released';
};

// Method to check if job can be started
jobSchema.methods.canBeStarted = function() {
  return this.status === 'accepted' && this.paymentStatus === 'paid';
};

// Method to check if job can be completed
jobSchema.methods.canBeCompleted = function() {
  return this.status === 'in_progress';
};

// Method to check if both parties confirmed
jobSchema.methods.isFullyConfirmed = function() {
  return this.customerConfirmed && this.artisanConfirmed;
};

// Method to confirm by customer
jobSchema.methods.confirmByCustomer = async function() {
  if (this.customerConfirmed) {
    throw new Error('Customer has already confirmed');
  }
  this.customerConfirmed = true;
  this.customerConfirmedAt = new Date();
  
  if (this.artisanConfirmed) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  return await this.save();
};

// Method to confirm by artisan
jobSchema.methods.confirmByArtisan = async function() {
  if (this.artisanConfirmed) {
    throw new Error('Artisan has already confirmed');
  }
  this.artisanConfirmed = true;
  this.artisanConfirmedAt = new Date();
  
  if (this.customerConfirmed) {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  return await this.save();
};

// Method to add application
jobSchema.methods.addApplication = async function(artisanId, message, proposedAmount) {
  const existing = this.applications?.find(
    app => app.artisanId.toString() === artisanId.toString()
  );
  
  if (existing) {
    throw new Error('You have already applied for this job');
  }
  
  if (!this.applications) {
    this.applications = [];
  }
  
  this.applications.push({
    artisanId,
    message: message?.trim(),
    proposedAmount,
    status: 'pending',
    appliedAt: new Date()
  });
  
  return await this.save();
};

// Method to accept application
jobSchema.methods.acceptApplication = async function(applicationIndex) {
  if (!this.applications || !this.applications[applicationIndex]) {
    throw new Error('Application not found');
  }
  
  this.applications[applicationIndex].status = 'accepted';
  this.status = 'accepted';
  this.artisanId = this.applications[applicationIndex].artisanId;
  
  // Reject other applications
  this.applications.forEach((app, idx) => {
    if (idx !== applicationIndex && app.status === 'pending') {
      app.status = 'rejected';
    }
  });
  
  return await this.save();
};

// Pre-save middleware to update timestamps
jobSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    if (this.status === 'in_progress' && !this.startedAt) {
      this.startedAt = now;
    }
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = now;
    }
    if (this.status === 'cancelled' && !this.cancelledAt) {
      this.cancelledAt = now;
    }
  }
  
  // Trim string fields
  if (this.title) this.title = this.title.trim();
  if (this.description) this.description = this.description.trim();
  if (this.cancellationReason) this.cancellationReason = this.cancellationReason.trim();
  
  next();
});

module.exports = mongoose.model('Job', jobSchema);