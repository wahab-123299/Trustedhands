const { AppError } = require('../utils/errorHandler');

// Helper: Parse time string to minutes
const parseTimeCtrl = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Helper: Format minutes to time string
const formatTimeCtrl = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Helper: Get date without time
const stripTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ==========================================
// SET AVAILABILITY FOR A DATE
// ==========================================
exports.setAvailability = async (req, res, next) => {
  try {
    const { date, slots, isBlocked, blockReason } = req.body;
    const artisanId = req.user._id;

    if (!date) {
      throw new AppError('VALIDATION_ERROR', 'Date is required');
    }

    const targetDate = stripTime(new Date(date));

    // Validate slots
    if (slots && Array.isArray(slots)) {
      for (const slot of slots) {
        if (!slot.startTime || !slot.endTime) {
          throw new AppError('VALIDATION_ERROR', 'Each slot must have startTime and endTime');
        }

        const start = parseTimeCtrl(slot.startTime);
        const end = parseTimeCtrl(slot.endTime);

        if (end - start < 30) {
          throw new AppError('VALIDATION_ERROR', 'Each slot must be at least 30 minutes');
        }

        if (start >= end) {
          throw new AppError('VALIDATION_ERROR', 'End time must be after start time');
        }
      }

      // Check for overlaps within the same request
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i];
          const b = slots[j];
          if (parseTimeCtrl(a.startTime) < parseTimeCtrl(b.endTime) && 
              parseTimeCtrl(a.endTime) > parseTimeCtrl(b.startTime)) {
            throw new AppError('VALIDATION_ERROR', 'Slots cannot overlap');
          }
        }
      }
    }

    // Upsert availability
    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      {
        $set: {
          slots: slots || [],
          isBlocked: isBlocked || false,
          blockReason: blockReason || '',
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Availability updated',
      data: { availability }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET AVAILABILITY FOR A DATE RANGE
// ==========================================
exports.getAvailability = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { artisanId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = stripTime(new Date(startDate));
      if (endDate) query.date.$lte = stripTime(new Date(endDate));
    }

    const availabilities = await AvailabilitySlot.find(query)
      .sort({ date: 1 })
      .lean();

    res.json({
      success: true,
      data: { availabilities }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BLOCK A DATE
// ==========================================
exports.blockDate = async (req, res, next) => {
  try {
    const { date, reason } = req.body;
    const artisanId = req.user._id;

    const targetDate = stripTime(new Date(date));

    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      {
        $set: {
          isBlocked: true,
          blockReason: reason || 'Blocked by artisan',
          slots: [],
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Date blocked',
      data: { availability }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UNBLOCK A DATE
// ==========================================
exports.unblockDate = async (req, res, next) => {
  try {
    const { date } = req.body;
    const artisanId = req.user._id;

    const targetDate = stripTime(new Date(date));

    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      {
        $set: {
          isBlocked: false,
          blockReason: '',
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Date unblocked',
      data: { availability }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CREATE RECURRING PATTERN
// ==========================================
exports.createRecurringPattern = async (req, res, next) => {
  try {
    const {
      patternType,
      daysOfWeek,
      timeSlots,
      startDate,
      endDate
    } = req.body;
    const artisanId = req.user._id;

    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(patternType)) {
      throw new AppError('VALIDATION_ERROR', 'Invalid pattern type');
    }

    if (!timeSlots || timeSlots.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one time slot is required');
    }

    // Validate time slots
    for (const slot of timeSlots) {
      if (parseTimeCtrl(slot.endTime) - parseTimeCtrl(slot.startTime) < 30) {
        throw new AppError('VALIDATION_ERROR', 'Each slot must be at least 30 minutes');
      }
    }

    const pattern = await RecurringPattern.create({
      artisanId,
      patternType,
      daysOfWeek: daysOfWeek || [],
      timeSlots,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      isActive: true
    });

    // Generate slots for the next 30 days
    await generateSlotsFromPattern(pattern);

    res.status(201).json({
      success: true,
      message: 'Recurring pattern created',
      data: { pattern }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET RECURRING PATTERNS
// ==========================================
exports.getRecurringPatterns = async (req, res, next) => {
  try {
    const artisanId = req.user._id;

    const patterns = await RecurringPattern.find({
      artisanId,
      isActive: true
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { patterns }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// DELETE RECURRING PATTERN
// ==========================================
exports.deleteRecurringPattern = async (req, res, next) => {
  try {
    const { patternId } = req.params;
    const artisanId = req.user._id;

    await RecurringPattern.findOneAndUpdate(
      { _id: patternId, artisanId },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Pattern deleted'
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CHECK ARTISAN AVAILABILITY FOR A JOB
// ==========================================
exports.checkAvailability = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { date, startTime, endTime } = req.query;

    if (!date || !startTime || !endTime) {
      throw new AppError('VALIDATION_ERROR', 'Date, startTime, and endTime are required');
    }

    const targetDate = stripTime(new Date(date));

    const availability = await AvailabilitySlot.findOne({
      artisanId,
      date: targetDate
    });

    if (!availability || availability.isBlocked) {
      return res.json({
        success: true,
        data: { 
          isAvailable: false, 
          reason: availability?.isBlocked ? 'Date is blocked' : 'No availability set' 
        }
      });
    }

    const slot = availability.findAvailableSlot(startTime, endTime);

    res.json({
      success: true,
      data: {
        isAvailable: !!slot,
        slot: slot || null,
        allSlots: availability.slots.filter(s => s.isAvailable && !s.isBooked)
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BOOK A SLOT (called when job is assigned)
// ==========================================
exports.bookSlot = async (artisanId, date, startTime, endTime, jobId) => {
  try {
    const targetDate = stripTime(new Date(date));

    const availability = await AvailabilitySlot.findOne({
      artisanId,
      date: targetDate
    });

    if (!availability || availability.isBlocked) {
      return { success: false, reason: 'Not available' };
    }

    const slot = availability.findAvailableSlot(startTime, endTime);
    if (!slot) {
      return { success: false, reason: 'No matching slot found' };
    }

    // Mark slot as booked
    slot.isBooked = true;
    slot.jobId = jobId;
    availability.updatedAt = new Date();
    await availability.save();

    return { success: true, slot };
  } catch (error) {
    console.error('[bookSlot] Error:', error);
    return { success: false, reason: error.message };
  }
};

// ==========================================
// CANCEL A BOOKING (called when job is cancelled)
// ==========================================
exports.cancelBooking = async (artisanId, date, jobId) => {
  try {
    const targetDate = stripTime(new Date(date));

    const availability = await AvailabilitySlot.findOne({
      artisanId,
      date: targetDate
    });

    if (!availability) return { success: false };

    const slot = availability.slots.find(s => 
      s.jobId?.toString() === jobId.toString()
    );

    if (slot) {
      slot.isBooked = false;
      slot.jobId = null;
      availability.updatedAt = new Date();
      await availability.save();
    }

    return { success: true };
  } catch (error) {
    console.error('[cancelBooking] Error:', error);
    return { success: false };
  }
};

// ==========================================
// HELPER: Generate slots from recurring pattern
// ==========================================
async function generateSlotsFromPattern(pattern) {
  const start = new Date(pattern.startDate);
  const end = pattern.endDate ? new Date(pattern.endDate) : new Date();
  end.setDate(end.getDate() + 30); // Generate 30 days ahead

  const current = new Date(start);
  const slotsToCreate = [];

  while (current <= end) {
    const dayOfWeek = current.getDay();

    let shouldCreate = false;

    switch (pattern.patternType) {
      case 'daily':
        shouldCreate = true;
        break;
      case 'weekly':
        shouldCreate = pattern.daysOfWeek.includes(dayOfWeek);
        break;
      case 'biweekly':
        shouldCreate = pattern.daysOfWeek.includes(dayOfWeek) && 
                        Math.floor((current - start) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
        break;
      case 'monthly':
        shouldCreate = current.getDate() === start.getDate();
        break;
    }

    // Check exceptions
    const isException = pattern.exceptions.some(e => 
      stripTime(e.date).getTime() === stripTime(current).getTime()
    );

    if (shouldCreate && !isException) {
      const dateKey = stripTime(current);

      // Check if entry already exists
      const existing = await AvailabilitySlot.findOne({
        artisanId: pattern.artisanId,
        date: dateKey
      });

      if (!existing) {
        slotsToCreate.push({
          artisanId: pattern.artisanId,
          date: dateKey,
          slots: pattern.timeSlots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: true,
            isBooked: false,
            recurringPatternId: pattern._id
          })),
          isBlocked: false
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  if (slotsToCreate.length > 0) {
    await AvailabilitySlot.insertMany(slotsToCreate, { ordered: false });
  }
}

// ==========================================
// STEP 4: Create routes/availabilityRoutes.js
// ==========================================
/*
const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { authenticate } = require('../middleware/auth');

// Artisan routes
router.post('/set', authenticate, availabilityController.setAvailability);
router.post('/block', authenticate, availabilityController.blockDate);
router.post('/unblock', authenticate, availabilityController.unblockDate);
router.get('/patterns', authenticate, availabilityController.getRecurringPatterns);
router.post('/patterns', authenticate, availabilityController.createRecurringPattern);
router.delete('/patterns/:patternId', authenticate, availabilityController.deleteRecurringPattern);

// Public routes
router.get('/:artisanId', availabilityController.getAvailability);
router.get('/:artisanId/check', availabilityController.checkAvailability);

module.exports = router;
*/

// ==========================================
// STEP 5: Add to app.js
// ==========================================
/*
// Add this line with other routes:
app.use('/api/availability', require('./routes/availabilityRoutes'));
*/

// ==========================================
// STEP 6: Add to models/index.js
// ==========================================
/*
const AvailabilitySlot = require('./AvailabilitySlot');
const RecurringPattern = require('./RecurringPattern');

module.exports = {
  // ... existing exports ...
  AvailabilitySlot,
  RecurringPattern
};
*/

// ==========================================
// STEP 7: Wire into job assignment flow
// In jobController.js acceptApplication(), AFTER assigning artisan:
// ==========================================
/*
// Book artisan's slot
try {
  const { bookSlot } = require('../controllers/availabilityController');
  const scheduledDate = job.scheduledDate;
  if (scheduledDate) {
    const dateStr = scheduledDate.toISOString().split('T')[0];
    // Default to a full day slot if no specific time
    await bookSlot(
      application.artisanId,
      dateStr,
      '08:00',
      '18:00',
      job._id
    );
  }
} catch (e) {
  console.error('[acceptApplication] Slot booking failed:', e.message);
}
*/

module.exports = {
  AvailabilitySlot,
  RecurringPattern,
  // Export controller methods if needed elsewhere
  setAvailability: exports.setAvailability,
  getAvailability: exports.getAvailability,
  blockDate: exports.blockDate,
  unblockDate: exports.unblockDate,
  createRecurringPattern: exports.createRecurringPattern,
  getRecurringPatterns: exports.getRecurringPatterns,
  deleteRecurringPattern: exports.deleteRecurringPattern,
  checkAvailability: exports.checkAvailability,
  bookSlot: exports.bookSlot,
  cancelBooking: exports.cancelBooking
};