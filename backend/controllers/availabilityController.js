const AppError = require('../utils/errorHandler').AppError;
const models = require('../models');
const AvailabilitySlot = models.AvailabilitySlot;
const RecurringPattern = models.RecurringPattern;

const ctrl = {};

ctrl.setAvailability = async (req, res, next) => {
    try{
        const artisanId = req.user._id;
        const targetDate = new Date(req.body.date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOneAndUpdate(
            { artisanId: artisanId, date: targetDate },
            { $set: {slots: req.body.slots || [], isBlocked:req.body.isBlocked || false, updatedAt: new Date() } },
            { upsert: true, new: true}
        );
        res.json({ success: true, data: { availability: availability } });
    } catch (error) {next(error); }
};

ctrl.getAvailability = async (req, res, next) => {
    try{
        const availabilities = await AvailabilitySlot.find({ artisanId: req.params.artisanId }).sort({ date: 1 }).lean();
        res.json({ success: true, data: { availabilities: availabilities} });
    } catch (error) { next(error); }
};


ctrl.blockDate = async (req, res, next) => {
    try{
        const targetDate = new Date(req.body.date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOneAndUpdate(
            { artisanId: req.user._id, date: targetDate },
            { $set: { isBlocked: true, slots: [], updatedAt: new Date() } },
            { upsert: true, new: true}
        );
        res.json({ success: true, data: { availability: availability } });
    } catch (error) { next(error); }
};

ctrl.unblockDate = async ( req, res, next) => {
    try{
        const targetDate = new Date(req.body.date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOneAndUpdate(
            { artisanId: req.user._id, date: targetDate },
            { $set: { isBlocked: false, updatedAt: new Date() } },
            { new: true }
        );
        res.json({ success: true, data: { availability: availability } });
    } catch (error) {next(error); }
};

ctrl.createRecurringPattern = async (req, res, next) => {
    try{
        const pattern = await RecurringPattern.create({
            artisanId: req.user._id,
            patternType: req.body.patternType,
            daysOfWeek: req.body.daysOfWeek || [],
            timeSlots: req.body.timeSlots,
            startDate: new Date(req.body.startDate),
            endDate: req.body.endDate ? new Date(req.body.endDate) : null,
            isActive: true
        });
        res.status(201).json({ success: true, data: {pattern: pattern} });
    } catch (error) {next(error); }
};

ctrl.getRecurringPatterns = async (req, res, next) => {
    try{
        const patterns = await RecurringPattern.find({ artisanId: req.user._id, isActive: true}).sort({ createdAt: -1 });
        res.json({ success: true, data: { patterns: patterns } });
    } catch (error) { next(error); }
};

ctrl.deleteRecurringPattern = async (req, res, next) => {
    try{
        await RecurringPattern.findOneAndUpdate({ _id: req.params.patternId, artisanId: req.user._id }, { isActive: false});
        res.json({ success: true });
    } catch (error) { next(error); }
};

ctrl.checkAvailability = async (req, res, next) =>{
    try{
        const targetDate = new Date(req.query.date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOne({ artisanId: req.params.artisanId, date: targetDate });
        if (!availability || availability.isBlocked) { 
            return res.json({ success: true, data: { isAvailable: false } });
        }
        const slot = availability.findAvailableSlot(req.query.startTime, req.query.endTime);
        res.json({ success: true, data: { isAvailable: !!slot } });
    } catch (error) { next(error); }
};

ctrl.bookSlot = async (artisanId, date, startTime, endTime, jobId) => {
    try {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOne({ artisanId: artisanId, date:targetDate });
        if (!availability || availability.isBlocked) return { success: false };
        const slot = availability.findAvailableSlot(startTime, endTime);
        if (!slot) return { success: false };
        slot.jobId = jobId;
        slot.isBooked = true;
        await availability.save();
        return { success: true, slot: slot };
    } catch (error) { return { success: false }; }
};

ctrl.cancelBooking = async (artisanId, date, jobId) => {
    try {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const availability = await AvailabilitySlot.findOne({ artisanId: artisanId, date: targetDate });
        if (!availability) return { success: false };
        const slot = availability.slots.find(function(s)  { return s.jobId && s.jobId.toString() === jobId.toString(); });
        if (slot) { slot.isBooked = false; slot.jobId = null; await availability.save(); }
        return { success: true};
    } catch (error) { return { success: false}; }
};

module.exports = ctrl;