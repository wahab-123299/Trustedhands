n = require('firebase-admin');

// ==========================================
// FEATURE 2: PUSH NOTIFICATIONS (Firebase Cloud Messaging)
// ==========================================
//
// STEP 1: Install dependency
// npm install firebase-admin
//
// STEP 2: Add to your .env file:
// FIREBASE_SERVICE_ACCOUNT_BASE64=<your_base64_encoded_service_account_json>
//
// STEP 3: Create this file: services/pushNotificationService.js
// ==========================================

let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return;
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (!serviceAccountBase64) {
      console.warn('[Firebase] No service account found. Push notifications disabled.');
      return;
    }

    const serviceAccount = JSON.parse(
      Buffer.from(serviceAccountBase64, 'base64').toString('utf8')
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    console.log('[Firebase] Push notification service initialized');
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error.message);
  }
};

// Initialize on module load
initializeFirebase();

// ==========================================
// PUSH NOTIFICATION TEMPLATES
// ==========================================

const pushTemplates = {
  new_job_alert: (data) => ({
    title: 'New Job Alert!',
    body: `A new "${data.jobTitle}" job was posted in your area. Tap to view.`,
    data: { type: 'new_job_alert', jobId: data.jobId?.toString() }
  }),
  application_received: (data) => ({
    title: 'New Application',
    body: `${data.artisanName} applied for "${data.jobTitle}"`,
    data: { type: 'application_received', jobId: data.jobId?.toString() }
  }),
  application_accepted: (data) => ({
    title: 'Application Accepted!',
    body: `Your application for "${data.jobTitle}" was accepted.`,
    data: { type: 'application_accepted', jobId: data.jobId?.toString() }
  }),
  application_rejected: (data) => ({
    title: 'Application Update',
    body: `Your application for "${data.jobTitle}" was not selected.`,
    data: { type: 'application_rejected', jobId: data.jobId?.toString() }
  }),
  job_started: (data) => ({
    title: 'Job Started',
    body: `${data.artisanName} has started working on "${data.jobTitle}"`,
    data: { type: 'job_started', jobId: data.jobId?.toString() }
  }),
  job_completed: (data) => ({
    title: 'Job Completed',
    body: `"${data.jobTitle}" has been marked as completed.`,
    data: { type: 'job_completed', jobId: data.jobId?.toString() }
  }),
  payment_received: (data) => ({
    title: 'Payment Received',
    body: `₦${data.amount?.toLocaleString()} received for "${data.jobTitle}" (held in escrow)`,
    data: { type: 'payment_received', jobId: data.jobId?.toString() }
  }),
  payment_released: (data) => ({
    title: 'Payment Released',
    body: `₦${data.amount?.toLocaleString()} released to your wallet!`,
    data: { type: 'payment_released', jobId: data.jobId?.toString() }
  }),
  review_received: (data) => ({
    title: 'New Review!',
    body: `You received a ${data.rating}-star review for "${data.jobTitle}"`,
    data: { type: 'review_received', jobId: data.jobId?.toString() }
  }),
  withdrawal_completed: (data) => ({
    title: 'Withdrawal Successful',
    body: `₦${data.amount?.toLocaleString()} has been sent to your bank account.`,
    data: { type: 'withdrawal_completed' }
  }),
  withdrawal_failed: (data) => ({
    title: 'Withdrawal Failed',
    body: `Your withdrawal of ₦${data.amount?.toLocaleString()} failed. ${data.reason || ''}`,
    data: { type: 'withdrawal_failed' }
  }),
  new_message: (data) => ({
    title: `New message from ${data.senderName}`,
    body: data.messagePreview?.substring(0, 100) || 'You have a new message',
    data: { type: 'new_message', conversationId: data.conversationId?.toString() }
  }),
  welcome: (data) => ({
    title: 'Welcome to TrustedHand!',
    body: `Hi ${data.name}, your account is ready. Complete your profile to get started.`,
    data: { type: 'welcome' }
  })
};

// ==========================================
// MAIN SERVICE FUNCTIONS
// ==========================================

class PushNotificationService {
  /**
   * Send push notification to a single user
   */
  static async sendToUser(user, type, data) {
    if (!firebaseInitialized) {
      console.warn('[Push] Firebase not initialized. Skipping push.');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    if (!user?.fcmTokens || user.fcmTokens.length === 0) {
      return { success: false, reason: 'no_fcm_tokens' };
    }

    const template = pushTemplates[type];
    if (!template) {
      console.warn(`[Push] No template found for type: ${type}`);
      return { success: false, reason: 'no_template' };
    }

    const payload = template(data);
    const results = [];
    const invalidTokens = [];

    for (const token of user.fcmTokens) {
      try {
        await admin.messaging().send({
          token,
          notification: {
            title: payload.title,
            body: payload.body
          },
          data: payload.data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'trustedhand_default',
              sound: 'default',
              icon: 'ic_notification'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          }
        });
        results.push({ token: token.substring(0, 20) + '...', success: true });
      } catch (error) {
        console.error(`[Push] Failed for token:`, error.message);
        results.push({ token: token.substring(0, 20) + '...', success: false, error: error.message });

        // Mark invalid tokens for removal
        if (error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token') {
          invalidTokens.push(token);
        }
      }
    }

    // Remove invalid tokens
    if (invalidTokens.length > 0 && user._id) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(user._id, {
        $pull: { fcmTokens: { $in: invalidTokens } }
      });
      console.log(`[Push] Removed ${invalidTokens.length} invalid tokens for user ${user._id}`);
    }

    return {
      success: results.some(r => r.success),
      results,
      invalidTokensRemoved: invalidTokens.length
    };
  }

  /**
   * Send to multiple users (batch)
   */
  static async sendToUsers(users, type, data) {
    const results = [];
    for (const user of users) {
      const result = await this.sendToUser(user, type, data);
      results.push({ userId: user._id, ...result });
    }
    return results;
  }

  /**
   * Subscribe user to a topic
   */
  static async subscribeToTopic(token, topic) {
    if (!firebaseInitialized) return { success: false };
    try {
      await admin.messaging().subscribeToTopic([token], topic);
      return { success: true };
    } catch (error) {
      console.error('[Push] Subscribe error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe user from a topic
   */
  static async unsubscribeFromTopic(token, topic) {
    if (!firebaseInitialized) return { success: false };
    try {
      await admin.messaging().unsubscribeFromTopic([token], topic);
      return { success: true };
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send to a topic
   */
  static async sendToTopic(topic, type, data) {
    if (!firebaseInitialized) return { success: false };

    const template = pushTemplates[type];
    if (!template) return { success: false, reason: 'no_template' };

    const payload = template(data);

    try {
      await admin.messaging().send({
        topic,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: payload.data
      });
      return { success: true };
    } catch (error) {
      console.error('[Push] Topic send error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PushNotificationService;