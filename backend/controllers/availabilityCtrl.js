const { AppError } = require('../utils/errorHandler');

// Defensive require with error logging
let AvailabilitySlot, RecurringPattern;
try {
  const models = require('../models');
  AvailabilitySlot = models.AvailabilitySlot;
  RecurringPattern = models.RecurringPattern;
  
  if (!AvailabilitySlot) {
    console.error('[availabilityController] ERROR: AvailabilitySlot model is undefined!');
    console.error('[availabilityController] Available models:', Object.keys(models));
  }
  if (!RecurringPattern) {
    console.error('[availabilityController] ERROR: RecurringPattern model is undefined!');
  }
} catch (err) {
  console.error('[availabilityController] ERROR loading models:', err.message);
  console.error(err.stack);
}

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
// CONTROLLER OBJECT
// ==========================================
const availabilityController = {};

// SET AVAILABILITY FOR A DATE
availabilityController.setAvailability = async (req, res, next) => {
  try {
    if (!AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'AvailabilitySlot model not loaded');
    }

    const { date, slots, isBlocked, blockReason } = req.body;
    const artisanId = req.user._id;

    if (!date) {
      throw new AppError('VALIDATION_ERROR', 'Date is required');
    }

    const targetDate = stripTime(new Date(date));

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

// GET AVAILABILITY FOR A DATE RANGE
availabilityController.getAvailability = async (req, res, next) => {
  try {
    if (!AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'AvailabilitySlot model not loaded');
    }

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

// BLOCK A DATE
availabilityController.blockDate = async (req, res, next) => {
  try {
    if (!AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'AvailabilitySlot model not loaded');
    }

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

// UNBLOCK A DATE
availabilityController.unblockDate = async (req, res, next) => {
  try {
    if (!AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'AvailabilitySlot model not loaded');
    }

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

// CREATE RECURRING PATTERN
availabilityController.createRecurringPattern = async (req, res, next) => {
  try {
    if (!RecurringPattern || !AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'Required models not loaded');
    }

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

// GET RECURRING PATTERNS
availabilityController.getRecurringPatterns = async (req, res, next) => {
  try {
    if (!RecurringPattern) {
      throw new AppError('SERVER_ERROR', 'RecurringPattern model not loaded');
    }

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

// DELETE RECURRING PATTERN
availabilityController.deleteRecurringPattern = async (req, res, next) => {
  try {
    if (!RecurringPattern) {
      throw new AppError('SERVER_ERROR', 'RecurringPattern model not loaded');
    }

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

// CHECK ARTISAN AVAILABILITY FOR A JOB
availabilityController.checkAvailability = async (req, res, next) => {
  try {
    if (!AvailabilitySlot) {
      throw new AppError('SERVER_ERROR', 'AvailabilitySlot model not loaded');
    }

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
        allSlots: (availability.slots || []).filter(s => s.isAvailable && !s.isBooked)
      }
    });
  } catch (error) {
    next(error);
  }
};

// BOOK A SLOT (called when job is assigned)
availabilityController.bookSlot = async (artisanId, date, startTime, endTime, jobId) => {
  try {
    if (!AvailabilitySlot) {
      console.error('[bookSlot] ERROR: AvailabilitySlot model not loaded');
      return { success: false, reason: 'Model not loaded' };
    }

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

// CANCEL A BOOKING (called when job is cancelled)
availabilityController.cancelBooking = async (artisanId, date, jobId) => {
  try {
    if (!AvailabilitySlot) {
      console.error('[cancelBooking] ERROR: AvailabilitySlot model not loaded');
      return { success: false };
    }

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

// HELPER: Generate slots from recurring pattern
async function generateSlotsFromPattern(pattern) {
  const start = new Date(pattern.startDate);
  const end = pattern.endDate ? new Date(pattern.endDate) : new Date();
  end.setDate(end.getDate() + 30);

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
        shouldCreate = pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek);
        break;
      case 'biweekly':
        shouldCreate = pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek) && 
                        Math.floor((current - start) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
        break;
      case 'monthly':
        shouldCreate = current.getDate() === start.getDate();
        break;
    }

    const exceptions = pattern.exceptions || [];
    const isException = exceptions.some(e => 
      e.date && stripTime(e.date).getTime() === stripTime(current).getTime()
    );

    if (shouldCreate && !isException) {
      const dateKey = stripTime(current);

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
// SINGLE EXPORT — no duplicates, no old code after this
// ==========================================
module.exports = availabilityController;

