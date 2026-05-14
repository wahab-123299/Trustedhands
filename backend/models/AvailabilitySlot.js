const mongoose = require('mongoose');


// ==========================================
// STEP 1: Create models/AvailabilitySlot.js
// ==========================================

const availabilitySlotSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // The specific date (e.g., 2024-06-15)
  date: {
    type: Date,
    required: true,
    index: true
  },
  // Time slots for this date
  slots: [{
    startTime: {
      type: String, // "HH:MM" format (24h)
      required: true
    },
    endTime: {
      type: String, // "HH:MM" format (24h)
      required: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    isBooked: {
      type: Boolean,
      default: false
    },
    // If booked, link to job
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null
    },
    // Recurring pattern this slot belongs to (if any)
    recurringPatternId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringPattern',
      default: null
    }
  }],
  // Is this date completely blocked?
  isBlocked: {
    type: Boolean,
    default: false
  },
  // Reason for blocking (e.g., "Personal day", "Sick leave")
  blockReason: {
    type: String,
    maxlength: 200
  },
  // Metadata
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

// Compound index for efficient queries
availabilitySlotSchema.index({ artisanId: 1, date: 1 }, { unique: true });

// Helper: Parse "HH:MM" to minutes since midnight
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper: Format minutes to "HH:MM"
function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Method: Check if a time range overlaps with existing slots
availabilitySlotSchema.methods.hasOverlap = function(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return this.slots.some(slot => {
    if (!slot.isAvailable || slot.isBooked) return false;
    const slotStart = parseTime(slot.startTime);
    const slotEnd = parseTime(slot.endTime);
    return (start < slotEnd && end > slotStart);
  });
};

// Method: Find available slot for a time range
availabilitySlotSchema.methods.findAvailableSlot = function(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  return this.slots.find(slot => {
    if (!slot.isAvailable || slot.isBooked) return false;
    const slotStart = parseTime(slot.startTime);
    const slotEnd = parseTime(slot.endTime);
    return start >= slotStart && end <= slotEnd;
  });
};

const AvailabilitySlot = mongoose.model('AvailabilitySlot', availabilitySlotSchema);

module.exports = AvailabilitySlot;