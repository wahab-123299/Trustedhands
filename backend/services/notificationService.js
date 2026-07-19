const Notification = require('../models/Notification');
const { sendEmail, sendWelcomeEmail, sendJobNotification, sendPaymentReceipt } = require('../utils/email');
const urls = require('../utils/frontendUrls'); // FIXED: Centralized URL builder
const { getIO } = require('../config/socket');

class NotificationService {
  async send({ user, type, channels = ['in_app'], data = {} }) {
    try {
      const results = [];

      // 1. In-app notification (always save to DB)
      if (channels.includes('in_app')) {
        const inApp = await this.createInApp(user._id, type, data);
        results.push({ channel: 'in_app', success: true, id: inApp._id });

        // Real-time emit via Socket.IO
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
        const emailResult = await this.sendEmailByType(type, user, data);
        if (emailResult) {
          results.push({ channel: 'email', ...emailResult });
        }
      }

      // Push notification via FCM
      if (channels.includes('push')) {
        const pushResult = await this.sendPushNotification(user, type, data);
        if (pushResult) {
          results.push({ channel: 'push', ...pushResult });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Notification service error:', error);
      return { success: false, error: error.message };
    }
  }

  // Dedicated push notification method
  async sendPushNotification(user, type, data) {
    try {
      if (!user.fcmTokens || user.fcmTokens.length === 0) {
        return null;
      }

      const pushNotificationService = require('./pushNotificationService');
      const pushPayload = this.buildPushPayload(type, data);

      const pushResult = await pushNotificationService.sendToUser(
        user._id,
        pushPayload.title,
        pushPayload.body,
        {
          type,
          ...pushPayload.data
        }
      );

      return pushResult;
    } catch (error) {
      console.error('Push notification error:', error);
      return { success: false, error: error.message };
    }
  }

  // Build push notification payload
  buildPushPayload(type, data) {
    const payloads = {
      welcome: {
        title: 'Welcome to TrustedHand!',
        body: `Hi ${data.name || 'there'}, your registration was successful.`,
        data: { screen: 'home' }
      },
      login_alert: {
        title: 'New Login Detected',
        body: 'A new login was detected on your account. Tap to review.',
        data: { screen: 'security' }
      },
      email_verified: {
        title: 'Email Verified!',
        body: 'Your email has been verified successfully.',
        data: { screen: 'profile' }
      },
      password_changed: {
        title: 'Password Changed',
        body: 'Your password was changed successfully.',
        data: { screen: 'security' }
      },
      new_booking: {
        title: 'New Booking Request',
        body: `${data.customerName} wants to book you for "${data.jobTitle}"`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      booking_confirmed: {
        title: 'Booking Confirmed',
        body: `${data.artisanName} has accepted your booking`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      booking_declined: {
        title: 'Booking Declined',
        body: `${data.artisanName} declined your booking request`,
        data: { screen: 'findArtisans' }
      },
      new_job_alert: {
        title: 'New Job Alert',
        body: `New job matching your skills: "${data.jobTitle}"`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      job_assigned: {
        title: 'Job Assigned',
        body: `You've been assigned to "${data.jobTitle}"`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      job_started: {
        title: 'Job Started',
        body: `${data.artisanName} has started working on your job`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      job_completed: {
        title: 'Job Completed',
        body: `Your job "${data.jobTitle}" has been completed`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      payment_received: {
        title: 'Payment Received',
        body: `You received ₦${data.amount?.toLocaleString()} for "${data.jobTitle}"`,
        data: { screen: 'wallet' }
      },
      review_received: {
        title: 'New Review',
        body: `You received a ${data.rating}-star review from ${data.customerName}`,
        data: { screen: 'reviews' }
      },
      application_received: {
        title: 'New Application',
        body: `${data.artisanName} applied for your job "${data.jobTitle}"`,
        data: { screen: 'jobApplications', jobId: data.jobId }
      },
      application_accepted: {
        title: 'Application Accepted',
        body: `Your application for "${data.jobTitle}" was accepted`,
        data: { screen: 'jobDetails', jobId: data.jobId }
      },
      application_rejected: {
        title: 'Application Rejected',
        body: `Your application for "${data.jobTitle}" was not selected`,
        data: { screen: 'myApplications' }
      }
    };

    return payloads[type] || {
      title: 'TrustedHand',
      body: 'You have a new notification',
      data: { screen: 'notifications' }
    };
  }

  // Send email based on notification type
  async sendEmailByType(type, user, data) {
    try {
      switch (type) {
        case 'welcome':
          return await sendWelcomeEmail(user);

        case 'new_job_alert':
          return await sendJobNotification(user, data.job, 'new_job');

        case 'job_started':
          return await sendJobNotification(user, data.job, 'job_started');

        case 'job_completed':
          return await sendJobNotification(user, data.job, 'job_completed');

        case 'payment_received':
          return await sendPaymentReceipt(user, data.transaction);

        case 'application_accepted':
        case 'booking_confirmed':
          return await sendJobNotification(user, data.job, 'job_accepted');

        case 'new_booking':
          return await this.sendGenericEmail(user, {
            subject: 'New Booking Request - TrustedHand',
            title: 'New Booking Request',
            message: `${data.customerName} wants to book you for "${data.jobTitle}"`,
            actionText: 'View Booking',
            actionUrl: urls.artisan.jobDetails(data.jobId)
          });

        case 'application_received':
          return await this.sendGenericEmail(user, {
            subject: 'New Application - TrustedHand',
            title: 'New Job Application',
            message: `${data.artisanName} applied for your job "${data.jobTitle}"`,
            actionText: 'View Applications',
            // FIXED: No /applications sub-route; link to job detail
            actionUrl: urls.customer.jobs(data.jobId)
          });

        case 'booking_declined':
          return await this.sendGenericEmail(user, {
            subject: 'Booking Declined - TrustedHand',
            title: 'Booking Declined',
            message: `${data.artisanName} declined your booking request for "${data.jobTitle}"`,
            actionText: 'Find Other Artisans',
            actionUrl: urls.public.artisans
          });

        case 'review_received':
          return await this.sendGenericEmail(user, {
            subject: 'New Review - TrustedHand',
            title: 'New Review Received',
            message: `You received a ${data.rating}-star review from ${data.customerName}!`,
            actionText: 'View Reviews',
            actionUrl: urls.artisan.profile
          });

        default:
          console.log(`No email handler for type: ${type}`);
          return null;
      }
    } catch (error) {
      console.error(`Failed to send ${type} email:`, error);
      return { success: false, error: error.message };
    }
  }

  // Generic email builder for simple notifications
  async sendGenericEmail(user, { subject, title, message, actionText, actionUrl }) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
          <p style="color: #6B7280; margin: 5px 0;">Nigeria's Trusted Marketplace for Skilled Artisans</p>
        </div>

        <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
          <h2 style="color: #10B981; margin-top: 0;">${title}</h2>
          <p>Hi ${user.fullName},</p>
          <p>${message}</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionUrl}" 
               style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              ${actionText}
            </a>
          </div>
        </div>

        <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
          <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
          <p>Lagos, Nigeria</p>
        </div>
      </body>
      </html>
    `;

    return await sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  async createInApp(userId, type, data) {
    const templates = {
      welcome: {
        title: 'Welcome to TrustedHand!',
        message: `Hi ${data.name || 'there'}, your registration was successful. Start exploring!`
      },
      login_alert: {
        title: 'New Login Detected',
        message: `A new login was detected on your account from ${data.device || 'an unknown device'} at ${data.ip || 'unknown IP'}. If this wasn't you, change your password immediately.`
      },
      email_verified: {
        title: 'Email Verified!',
        message: `Hi ${data.name || 'there'}, your email has been verified successfully. You now have full access to TrustedHand.`
      },
      password_changed: {
        title: 'Password Changed',
        message: `Hi ${data.name || 'there'}, your password was changed successfully. If you didn't do this, contact support immediately.`
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