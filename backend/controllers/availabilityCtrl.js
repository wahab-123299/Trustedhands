const { AppError } = require('../utils/errorHandler');

let AvailabilitySlot, RecurringPattern;
try {
  const models = require('../models');
  AvailabilitySlot = models.AvailabilitySlot;
  RecurringPattern = models.RecurringPattern;
} catch (err) {
  console.error('Model load error:', err.message);
}

const parseTime = (timeStr) => {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
};

const stripTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const ctrl = {};

ctrl.setAvailability = async (req, res, next) => {
  try {
    const { date, slots, isBlocked, blockReason } = req.body;
    const artisanId = req.user._id;
    if (!date) throw new AppError('VALIDATION_ERROR', 'Date is required');
    
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      { $set: { slots: slots || [], isBlocked: isBlocked || false, blockReason: blockReason || '', updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Availability updated', data: { availability } });
  } catch (error) { next(error); }
};

ctrl.getAvailability = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { startDate, endDate } = req.query;
    const query = { artisanId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = stripTime(new Date(startDate));
      if (endDate) query.date.$lte = stripTime(new Date(endDate));
    }
    const availabilities = await AvailabilitySlot.find(query).sort({ date: 1 }).lean();
    res.json({ success: true, data: { availabilities } });
  } catch (error) { next(error); }
};

ctrl.blockDate = async (req, res, next) => {
  try {
    const { date, reason } = req.body;
    const artisanId = req.user._id;
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      { $set: { isBlocked: true, blockReason: reason || 'Blocked by artisan', slots: [], updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Date blocked', data: { availability } });
  } catch (error) { next(error); }
};

ctrl.unblockDate = async (req, res, next) => {
  try {
    const { date } = req.body;
    const artisanId = req.user._id;
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOneAndUpdate(
      { artisanId, date: targetDate },
      { $set: { isBlocked: false, blockReason: '', updatedAt: new Date() } },
      { new: true }
    );
    res.json({ success: true, message: 'Date unblocked', data: { availability } });
  } catch (error) { next(error); }
};

ctrl.createRecurringPattern = async (req, res, next) => {
  try {
    const { patternType, daysOfWeek, timeSlots, startDate, endDate } = req.body;
    const artisanId = req.user._id;
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(patternType)) throw new AppError('VALIDATION_ERROR', 'Invalid pattern type');
    if (!timeSlots || timeSlots.length === 0) throw new AppError('VALIDATION_ERROR', 'At least one time slot is required');
    const pattern = await RecurringPattern.create({
      artisanId, patternType, daysOfWeek: daysOfWeek || [], timeSlots,
      startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : null, isActive: true
    });
    await generateSlots(pattern);
    res.status(201).json({ success: true, message: 'Recurring pattern created', data: { pattern } });
  } catch (error) { next(error); }
};

ctrl.getRecurringPatterns = async (req, res, next) => {
  try {
    const artisanId = req.user._id;
    const patterns = await RecurringPattern.find({ artisanId, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: { patterns } });
  } catch (error) { next(error); }
};

ctrl.deleteRecurringPattern = async (req, res, next) => {
  try {
    const { patternId } = req.params;
    const artisanId = req.user._id;
    await RecurringPattern.findOneAndUpdate({ _id: patternId, artisanId }, { isActive: false });
    res.json({ success: true, message: 'Pattern deleted' });
  } catch (error) { next(error); }
};

ctrl.checkAvailability = async (req, res, next) => {
  try {
    const { artisanId } = req.params;
    const { date, startTime, endTime } = req.query;
    if (!date || !startTime || !endTime) throw new AppError('VALIDATION_ERROR', 'Date, startTime, and endTime are required');
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOne({ artisanId, date: targetDate });
    if (!availability || availability.isBlocked) {
      return res.json({ success: true, data: { isAvailable: false, reason: availability && availability.isBlocked ? 'Date is blocked' : 'No availability set' } });
    }
    const slot = availability.findAvailableSlot(startTime, endTime);
    res.json({ success: true, data: { isAvailable: !!slot, slot: slot || null, allSlots: (availability.slots || []).filter(s => s.isAvailable && !s.isBooked) } });
  } catch (error) { next(error); }
};

ctrl.bookSlot = async (artisanId, date, startTime, endTime, jobId) => {
  try {
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOne({ artisanId, date: targetDate });
    if (!availability || availability.isBlocked) return { success: false, reason: 'Not available' };
    const slot = availability.findAvailableSlot(startTime, endTime);
    if (!slot) return { success: false, reason: 'No matching slot found' };
    slot.isBooked = true;
    slot.jobId = jobId;
    availability.updatedAt = new Date();
    await availability.save();
    return { success: true, slot };
  } catch (error) {
    console.error('bookSlot error:', error);
    return { success: false, reason: error.message };
  }
};

ctrl.cancelBooking = async (artisanId, date, jobId) => {
  try {
    const targetDate = stripTime(new Date(date));
    const availability = await AvailabilitySlot.findOne({ artisanId, date: targetDate });
    if (!availability) return { success: false };
    const slot = availability.slots.find(s => s.jobId && s.jobId.toString() === jobId.toString());
    if (slot) {
      slot.isBooked = false;
      slot.jobId = null;
      availability.updatedAt = new Date();
      await availability.save();
    }
    return { success: true };
  } catch (error) {
    console.error('cancelBooking error:', error);
    return { success: false };
  }
};

async function generateSlots(pattern) {
  const start = new Date(pattern.startDate);
  const end = pattern.endDate ? new Date(pattern.endDate) : new Date();
  end.setDate(end.getDate() + 30);
  const current = new Date(start);
  const slotsToCreate = [];
  while (current <= end) {
    const dayOfWeek = current.getDay();
    let shouldCreate = false;
    switch (pattern.patternType) {
      case 'daily': shouldCreate = true; break;
      case 'weekly': shouldCreate = pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek); break;
      case 'biweekly': shouldCreate = pattern.daysOfWeek && pattern.daysOfWeek.includes(dayOfWeek) && Math.floor((current - start) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0; break;
      case 'monthly': shouldCreate = current.getDate() === start.getDate(); break;
    }
    const exceptions = pattern.exceptions || [];
    const isException = exceptions.some(e => e.date && stripTime(e.date).getTime() === stripTime(current).getTime());
    if (shouldCreate && !isException) {
      const dateKey = stripTime(current);
      const existing = await AvailabilitySlot.findOne({ artisanId: pattern.artisanId, date: dateKey });
      if (!existing) {
        slotsToCreate.push({
          artisanId: pattern.artisanId, date: dateKey,
          slots: pattern.timeSlots.map(slot => ({ startTime: slot.startTime, endTime: slot.endTime, isAvailable: true, isBooked: false, recurringPatternId: pattern._id })),
          isBlocked: false
        });
      }
    }
    current.setDate(current.getDate() + 1);
  }
  if (slotsToCreate.length > 0) await AvailabilitySlot.insertMany(slotsToCreate, { ordered: false });
}

module.exports = ctrl;