const recurringPatternSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Pattern type
  patternType: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
    required: true
  },
  // For weekly/biweekly: which days (0=Sunday, 6=Saturday)
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6
  }],
  // Time slots that repeat
  timeSlots: [{
    startTime: {
      type: String, // "HH:MM"
      required: true
    },
    endTime: {
      type: String, // "HH:MM"
      required: true
    }
  }],
  // Date range for this pattern
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    default: null // null = indefinite
  },
  // Is this pattern active?
  isActive: {
    type: Boolean,
    default: true
  },
  // Exceptions (dates to skip)
  exceptions: [{
    date: Date,
    reason: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

recurringPatternSchema.index({ artisanId: 1, isActive: 1 });

const RecurringPattern = mongoose.model('RecurringPattern', recurringPatternSchema);