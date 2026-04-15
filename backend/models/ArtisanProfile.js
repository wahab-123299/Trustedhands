const mongoose = require('mongoose');

const artisanProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    unique: true,
    index: true
  },
  Profession: {
    type: String,
    required: [true, 'Profession is required'],
    trim: true,
    minlength: [2, 'Profession must be at least 2 characters'],
    maxlength: [100, 'Profession cannot exceed 100 characters']
  },
  // ✅ FIXED: Removed strict enum, added length validation
  skills: [{
    type: String,
    required: [true, 'At least one skill is required'],
    minlength: [2, 'Skill must be at least 2 characters'],
    maxlength: [50, 'Skill cannot exceed 50 characters'],
    trim: true
  }],
  experienceYears: {
    type: String,
    enum: ['0-1', '1-3', '3-5', '5-10', '10+'],
    required: [true, 'Years of experience is required']
  },
  rate: {
    amount: {
      type: Number,
      required: [true, 'Rate amount is required'],
      min: [500, 'Minimum rate is ₦500'],
      default: 500
    },
    period: {
      type: String,
      enum: ['hour', 'day', 'job'],
      required: [true, 'Rate period is required'],
      default: 'job'
    }
  },
  idVerification: {
    idType: {
      type: String,
      enum: ['nin', 'drivers_license', 'voters_card', 'passport']
    },
    idNumber: { type: String, trim: true },
    documentImage: String,
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    submittedAt: { type: Date, default: Date.now }
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  },
  portfolioImages: {
    type: [{
      type: String,
      validate: {
        validator: function(v) {
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Invalid image URL format'
      }
    }],
    validate: {
      validator: function(v) {
        return v.length <= 6;
      },
      message: 'Maximum 6 portfolio images allowed'
    },
    default: []
  },
  availability: {
    status: {
      type: String,
      enum: ['available', 'unavailable', 'busy'],
      default: 'available'
    },
    nextAvailableDate: Date
  },
  workRadius: {
    type: String,
    enum: ['5', '10', '20', '50', 'any'],
    default: 'any'
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
    set: v => Math.round(v * 10) / 10
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  },
  completedJobs: {
    type: Number,
    default: 0,
    min: 0
  },
  responseTime: { type: Number, min: 0 },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet'
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
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  isCertified: {
    type: Boolean,
    default: false
  },
  certificationDate: Date,
  canApplyForHighValueJobs: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
artisanProfileSchema.index({ skills: 1 });
artisanProfileSchema.index({ 'availability.status': 1 });
artisanProfileSchema.index({ averageRating: -1 });
artisanProfileSchema.index({ 'rate.amount': 1 });
artisanProfileSchema.index({ experienceYears: 1 });
artisanProfileSchema.index({ 
  skills: 1, 
  'availability.status': 1, 
  averageRating: -1 
});

// Virtual populate for user details
artisanProfileSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Method to check if artisan can apply for a job
artisanProfileSchema.methods.canApplyForJob = function(jobBudget) {
  const experienceMap = {
    '0-1': { maxBudget: 50000, canApply: true },
    '1-3': { maxBudget: 200000, canApply: true },
    '3-5': { maxBudget: 500000, canApply: true },
    '5-10': { maxBudget: 1000000, canApply: true },
    '10+': { maxBudget: Infinity, canApply: true }
  };

  const experience = experienceMap[this.experienceYears];
  
  if (!experience) return { canApply: false, reason: 'Invalid experience level' };
  
  if (jobBudget > experience.maxBudget) {
    return { 
      canApply: false, 
      reason: `Your experience level (${this.experienceYears} years) limits you to jobs up to ₦${experience.maxBudget.toLocaleString()}. This job exceeds that amount.` 
    };
  }
  
  return { canApply: true };
};

// Method to update rating
artisanProfileSchema.methods.updateRating = async function(newRating) {
  const currentTotal = this.averageRating * this.totalReviews;
  this.totalReviews += 1;
  this.averageRating = (currentTotal + newRating) / this.totalReviews;
  await this.save();
};

// Pre-save middleware
artisanProfileSchema.pre('save', function(next) {
  if (this.experienceYears && ['3-5', '5-10', '10+'].includes(this.experienceYears)) {
    if (this.idVerification && this.idVerification.isVerified) {
      this.isCertified = true;
      this.canApplyForHighValueJobs = true;
      if (!this.certificationDate) {
        this.certificationDate = new Date();
      }
    }
  }
  
  if (!this.rate) {
    this.rate = { amount: 500, period: 'job' };
  }
  
  next();
});

// Static method to find available artisans by skill
artisanProfileSchema.statics.findAvailableBySkill = function(skill, options = {}) {
  const query = {
    skills: { $regex: new RegExp(skill, 'i') }, // ✅ Case-insensitive search
    'availability.status': 'available'
  };
  
  if (options.minRating) {
    query.averageRating = { $gte: options.minRating };
  }
  
  if (options.maxRate) {
    query['rate.amount'] = { $lte: options.maxRate };
  }
  
  return this.find(query)
    .populate('userId', 'fullName location profileImage phone')
    .sort({ averageRating: -1 })
    .limit(options.limit || 20);
};

module.exports = mongoose.model('ArtisanProfile', artisanProfileSchema);