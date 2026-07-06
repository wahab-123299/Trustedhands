// backend/controllers/availabilityController.js
const { AppError } = require('../utils/errorHandler');
const { AvailabilitySlot, RecurringPattern } = require('../models');

// ==========================================
// SET / UPDATE AVAILABILITY
// ==========================================

exports.setAvailability = async (req, res, next) => {
  try {
    const artisanId = req.user._id;
    const targetDate = new Date(req.body.date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      {
        $set: {
          slots: req.body.slots || [],
          isBlocked: req.body.isBlocked || false,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: { availability } });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// GET AVAILABILITY
// ==========================================

exports.getAvailability = async (req, res, next) => {
  try {
    const availabilities = await AvailabilitySlot
      .find({ artisanId: req.params.artisanId })
      .sort({ date: 1 })
      .lean();

    res.json({ success: true, data: { availabilities } });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// BLOCK DATE
// ==========================================

exports.blockDate = async (req, res, next) => {
  try {
    const targetDate = new Date(req.body.date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId: req.user._id, date: targetDate },
      {
        $set: {
          isBlocked: true,
          slots: [],
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: { availability } });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// UNBLOCK DATE
// ==========================================

exports.unblockDate = async (req, res, next) => {
  try {
    const targetDate = new Date(req.body.date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId: req.user._id, date: targetDate },
      {
        $set: {
          isBlocked: false,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({ success: true, data: { availability } });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// RECURRING PATTERNS
// ==========================================

exports.createRecurringPattern = async (req, res, next) => {
  try {
    const pattern = await RecurringPattern.create({
      artisanId: req.user._id,
      patternType: req.body.patternType,
      daysOfWeek: req.body.daysOfWeek || [],
      timeSlots: req.body.timeSlots,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      isActive: true
    });

    res.status(201).json({ success: true, data: { pattern } });
  } catch (error) {
    next(error);
  }
};

exports.getRecurringPatterns = async (req, res, next) => {
  try {
    const patterns = await RecurringPattern
      .find({ artisanId: req.user._id, isActive: true })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { patterns } });
  } catch (error) {
    next(error);
  }
};

exports.deleteRecurringPattern = async (req, res, next) => {
  try {
    await RecurringPattern.findOneAndUpdate(
      { _id: req.params.patternId, artisanId: req.user._id },
      { isActive: false }
    );

    res.json({ success: true, message: 'Pattern deleted' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CHECK AVAILABILITY (Public)
// ==========================================

exports.checkAvailability = async (req, res, next) => {
  try {
    const targetDate = new Date(req.query.date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOne({
      artisanId: req.params.artisanId,
      date: targetDate
    });

    if (!availability || availability.isBlocked) {
      return res.json({ success: true, data: { isAvailable: false } });
    }

    const slot = availability.findAvailableSlot(req.query.startTime, req.query.endTime);

    res.json({ success: true, data: { isAvailable: !!slot } });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// SERVICE FUNCTIONS (Not route handlers)
// ==========================================

exports.bookSlot = async (artisanId, date, startTime, endTime, jobId) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOne({
      artisanId,
      date: targetDate
    });

    if (!availability || availability.isBlocked) {
      return { success: false, reason: 'not_found_or_blocked' };
    }

    const slot = availability.findAvailableSlot(startTime, endTime);
    if (!slot) {
      return { success: false, reason: 'no_slot' };
    }

    slot.jobId = jobId;
    slot.isBooked = true;
    await availability.save();

    return { success: true, slot };
  } catch (error) {
    console.error('[bookSlot] Error:', error.message);
    return { success: false, reason: 'error' };
  }
};

exports.cancelBooking = async (artisanId, date, jobId) => {
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const availability = await AvailabilitySlot.findOne({
      artisanId,
      date: targetDate
    });

    if (!availability) {
      return { success: false, reason: 'not_found' };
    }

    const slot = availability.slots.find(
      (s) => s.jobId && s.jobId.toString() === jobId.toString()
    );

    if (slot) {
      slot.isBooked = false;
      slot.jobId = null;
      await availability.save();
    }

    return { success: true };
  } catch (error) {
    console.error('[cancelBooking] Error:', error.message);
    return { success: false, reason: 'error' };
  }
};