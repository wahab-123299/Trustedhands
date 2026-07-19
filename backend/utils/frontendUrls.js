/**
 * Centralized frontend URL builder
 * Ensures all backend-generated links match actual frontend routes
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://trustedhand.org';

const urls = {
  base: FRONTEND_URL,

  customer: {
    dashboard: `${FRONTEND_URL}/customer/dashboard`,
    jobs: (id) => id ? `${FRONTEND_URL}/customer/jobs/${id}` : `${FRONTEND_URL}/customer/jobs`,
    jobApplications: (id) => `${FRONTEND_URL}/customer/jobs/${id}`, // applications shown on same page
    bookings: `${FRONTEND_URL}/customer/bookings`,
    messages: `${FRONTEND_URL}/customer/messages`,
    profile: `${FRONTEND_URL}/customer/profile`,
    verification: `${FRONTEND_URL}/customer/verify`,
    postJob: `${FRONTEND_URL}/customer/post-job`,
    wallet: `${FRONTEND_URL}/customer/wallet`, // or payments page
  },

  artisan: {
    dashboard: `${FRONTEND_URL}/artisan/dashboard`,
    jobs: `${FRONTEND_URL}/artisan/jobs`,
    jobDetails: (id) => `${FRONTEND_URL}/artisan/jobs/${id}`,
    applications: `${FRONTEND_URL}/artisan/applications`,
    messages: `${FRONTEND_URL}/artisan/messages`,
    profile: `${FRONTEND_URL}/artisan/profile`,
    verification: `${FRONTEND_URL}/artisan/verify`,
    wallet: `${FRONTEND_URL}/artisan/wallet`,
  },

  admin: {
    dashboard: `${FRONTEND_URL}/admin/dashboard`,
    users: `${FRONTEND_URL}/admin/users`,
    artisans: `${FRONTEND_URL}/admin/artisans`,
    verifications: `${FRONTEND_URL}/admin/verifications`,
    stats: `${FRONTEND_URL}/admin/stats`,
    pressCreate: `${FRONTEND_URL}/admin/press/create`,
  },

  press: {
    list: `${FRONTEND_URL}/press`,
    article: (slug) => `${FRONTEND_URL}/press/${slug}`,
  },

  auth: {
    login: `${FRONTEND_URL}/login`,
    register: `${FRONTEND_URL}/register`,
    resetPassword: (token) => `${FRONTEND_URL}/reset-password/${token}`,
    verifyEmail: (token) => `${FRONTEND_URL}/verify-email/${token}`,
  },

  public: {
    home: FRONTEND_URL,
    artisans: `${FRONTEND_URL}/artisans`,
    jobs: `${FRONTEND_URL}/jobs`,
    about: `${FRONTEND_URL}/about`,
    help: `${FRONTEND_URL}/help`,
  }
};

module.exports = urls;