const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/email');
const { sendSMS, smsTemplates } = require('./smsService');
const { getIO } = require('../config/socket');

class NotificationService {
  async send({ user, type, channels = ['in_app'], data = {} }) {
    try {
      const results = [];

      // 1. In-app notification (always save to DB)
      if (channels.includes('in_app')) {
        const inApp = await this.createInApp(user._id, type, data);
        results.push({ channel: 'in_app', success: true, id: inApp._id });
        
        // Real-time emit
        const io = getIO();
        if (io) {
          io.to(`user_${user._id}`).emit('notification', {
            id: inApp._id,
            type,
            title: inApp.title,
            message: inApp.message,
            data: inApp.data,
            createdAt: inApp.createdAt,
            isRead: false
          });
        }
      }

      // 2. Email notification
      if (channels.includes('email') && user.email) {
        const emailData = this.getEmailTemplate(type, user, data);
        if (emailData) {
          const emailResult = await sendEmail({
            to: user.email,
            subject: emailData.subject,
            html: emailData.html
          });
          results.push({ channel: 'email', ...emailResult });
        }
      }

      // 3. SMS notification
      if (channels.includes('sms') && user.phone) {
        const smsData = this.getSMSTemplate(type, user, data);
        if (smsData) {
          const smsResult = await sendSMS({
            to: user.phone,
            message: smsData.message
          });
          results.push({ channel: 'sms', ...smsResult });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Notification service error:', error);
      return { success: false, error: error.message };
    }
  }

  async createInApp(userId, type, data) {
    const templates = {
      welcome: {
        title: 'Welcome to TrustedHand!',
        message: `Hi ${data.name || 'there'}, your registration was successful. Start exploring!`
      },
      new_booking: {
        title: 'New Booking Request',
        message: `${data.customerName} wants to book you for "${data.jobTitle}"`
      },
      booking_confirmed: {
        title: 'Booking Confirmed',
        message: `${data.artisanName} has accepted your booking`
      },
      booking_declined: {
        title: 'Booking Declined',
        message: `${data.artisanName} declined your booking request`
      },
      new_job_alert: {
        title: 'New Job Alert',
        message: `New job matching your skills: "${data.jobTitle}"`
      },
      job_assigned: {
        title: 'Job Assigned',
        message: `You've been assigned to "${data.jobTitle}"`
      },
      job_started: {
        title: 'Job Started',
        message: `${data.artisanName} has started working on your job`
      },
      job_completed: {
        title: 'Job Completed',
        message: `Your job "${data.jobTitle}" has been completed`
      },
      payment_received: {
        title: 'Payment Received',
        message: `You received ₦${data.amount?.toLocaleString()} for "${data.jobTitle}"`
      },
      review_received: {
        title: 'New Review',
        message: `You received a ${data.rating}-star review from ${data.customerName}`
      },
      application_received: {
        title: 'New Application',
        message: `${data.artisanName} applied for your job "${data.jobTitle}"`
      },
      application_accepted: {
        title: 'Application Accepted',
        message: `Your application for "${data.jobTitle}" was accepted`
      },
      application_rejected: {
        title: 'Application Rejected',
        message: `Your application for "${data.jobTitle}" was not selected`
      }
    };

    const template = templates[type] || { title: 'Notification', message: 'You have a new notification' };

    return await Notification.create({
      userId,
      type,
      title: template.title,
      message: template.message,
      data: {
        jobId: data.jobId,
        artisanId: data.artisanId,
        customerId: data.customerId,
        amount: data.amount,
        extra: data
      },
      channels: ['in_app'],
      isRead: false
    });
  }

  getEmailTemplate(type, user, data) {
    const { sendWelcomeEmail, sendJobNotification, sendPaymentReceipt } = require('../utils/email');
    
    switch (type) {
      case 'welcome':
        return { subject: 'Welcome!', html: null }; // Use existing sendWelcomeEmail
      case 'new_booking':
      case 'job_started':
      case 'job_completed':
        return { subject: 'Job Update', html: null }; // Use sendJobNotification
      case 'payment_received':
        return { subject: 'Payment Received', html: null }; // Use sendPaymentReceipt
      default:
        return null;
    }
  }

  getSMSTemplate(type, user, data) {
    const templates = {
      welcome: smsTemplates.welcome,
      new_booking: smsTemplates.newBooking,
      booking_confirmed: smsTemplates.bookingConfirmed,
      new_job_alert: smsTemplates.newJobAlert,
      job_started: smsTemplates.jobStarted,
      job_completed: smsTemplates.jobCompleted,
      payment_received: smsTemplates.paymentReceived
    };

    const templateFn = templates[type];
    return templateFn ? templateFn({ ...data, name: user.fullName }) : null;
  }

  // Get unread notifications
  async getUnread(userId) {
    return await Notification.find({ userId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(50);
  }

  // Get all notifications with pagination
  async getAll(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId })
    ]);

    return { notifications, total, page, pages: Math.ceil(total / limit) };
  }

  // Mark as read
  async markAsRead(notificationId, userId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  // Mark all as read
  async markAllAsRead(userId) {
    return await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  // Get unread count
  async getUnreadCount(userId) {
    return await Notification.countDocuments({ userId, isRead: false });
  }
}

module.exports = new NotificationService();