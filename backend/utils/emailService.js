require('dotenv').config();

const nodemailer = require('nodemailer');
const urls = require('./frontendUrls'); // FIXED: Centralized URL builder

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('[Email] Gmail SMTP connection failed:', error.message);
  } else {
    console.log('[Email] Gmail SMTP ready');
  }
});

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@trustedhand.org';
const FROM_NAME = process.env.FROM_NAME || 'TrustedHand';

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    });

    console.log(`[Email] Sent to ${to}: ${subject} (ID: ${info.messageId})`);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return { success: false, error: err.message };
  }
};

const emailTemplates = {
  welcome: (data) => ({
    subject: `Welcome to TrustedHand, ${data.name}!`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background: #10b981; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
          <span style="color: white; font-size: 32px; font-weight: bold;">T</span>
        </div>
        <h1 style="color: #111827; margin-top: 16px;">Welcome to TrustedHand!</h1>
      </div>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hi <strong>${data.name}</strong>,</p>
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your account has been created successfully.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.dashboardUrl}" style="background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Go to Dashboard</a>
      </div>
    </div>`,
  }),

  forgotPassword: (data) => ({
    subject: 'Reset your TrustedHand password',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">Password Reset</h1>
      <p>Hi <strong>${data.name}</strong>,</p>
      <p>Click the button below to reset your password:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.resetUrl}" style="background: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
    </div>`,
  }),

  newJob: (data) => ({
    subject: `New job: ${data.jobTitle}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">New Job Available!</h1>
      <p>Hi <strong>${data.artisanName}</strong>,</p>
      <p>A new job in <strong>${data.location}</strong> matches your skills.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <h3>${data.jobTitle}</h3>
        <p><strong>Budget:</strong> N${data.budget.toLocaleString()}</p>
        <p><strong>Location:</strong> ${data.location}</p>
      </div>
      <div style="text-align: center;">
        <a href="${data.jobUrl}" style="background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">View Job</a>
      </div>
    </div>`,
  }),

  jobApplication: (data) => ({
    subject: `${data.artisanName} applied for your job`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">New Application!</h1>
      <p>Hi <strong>${data.customerName}</strong>,</p>
      <p><strong>${data.artisanName}</strong> applied for "<em>${data.jobTitle}</em>".</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.applicationUrl}" style="background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Review Application</a>
      </div>
    </div>`,
  }),

  bookingConfirmed: (data) => ({
    subject: `Booking confirmed: ${data.jobTitle}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">Booking Confirmed!</h1>
      <p>Hi <strong>${data.name}</strong>,</p>
      <p>${data.role === 'customer' 
        ? `Your job "<strong>${data.jobTitle}</strong>" has been accepted.`
        : `You have been hired for "<strong>${data.jobTitle}</strong>".`
      }</p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Date:</strong> ${data.scheduledDate}</p>
        <p><strong>Budget:</strong> N${data.budget.toLocaleString()}</p>
      </div>
      <div style="text-align: center;">
        <a href="${data.jobUrl}" style="background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">View Job</a>
      </div>
    </div>`,
  }),

  paymentReceipt: (data) => ({
    subject: `Payment receipt - N${data.amount.toLocaleString()}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">Payment Received</h1>
      <p>Hi <strong>${data.name}</strong>,</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p><strong>Amount:</strong> N${data.amount.toLocaleString()}</p>
        <p><strong>Reference:</strong> ${data.reference}</p>
        <p><strong>Status:</strong> ${data.status === 'completed' ? 'Completed' : 'Pending'}</p>
      </div>
    </div>`,
  }),

  verificationStatus: (data) => ({
    subject: `Verification ${data.status === 'approved' ? 'Approved' : 'Update Required'}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #111827; text-align: center;">${data.status === 'approved' ? 'Approved!' : 'Update Needed'}</h1>
      <p>Hi <strong>${data.name}</strong>,</p>
      ${data.status === 'approved' 
        ? '<p>Your verification has been <strong style="color: #10b981;">approved</strong>!</p>' 
        : `<p>Your verification was not approved.</p><p><strong>Reason:</strong> ${data.reason}</p>`
      }
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.profileUrl}" style="background: ${data.status === 'approved' ? '#10b981' : '#f59e0b'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">${data.status === 'approved' ? 'View Profile' : 'Resubmit'}</a>
      </div>
    </div>`,
  }),
};

const emailService = {
  sendEmail,

  sendWelcome: async (user) => {
    const role = user.role || 'customer';
    const template = emailTemplates.welcome({
      name: user.fullName || user.name || 'there',
      dashboardUrl: role === 'artisan' ? urls.artisan.dashboard : urls.customer.dashboard,
    });
    return sendEmail({ to: user.email, ...template });
  },

  sendPasswordReset: async (user, resetToken) => {
    // FIXED: Path param format (matches frontend route /reset-password/:token)
    const resetUrl = urls.auth.resetPassword(resetToken);
    const template = emailTemplates.forgotPassword({
      name: user.fullName || user.name || 'there',
      resetUrl,
    });
    return sendEmail({ to: user.email, ...template });
  },

  sendNewJobAlert: async (artisan, job) => {
    const template = emailTemplates.newJob({
      artisanName: artisan.fullName || artisan.name,
      jobTitle: job.title,
      category: job.category,
      budget: job.budget,
      location: `${job.location ? job.location.city : ''}, ${job.location ? job.location.state : ''}`,
      scheduledDate: new Date(job.scheduledDate).toLocaleDateString('en-NG'),
      description: job.description,
      jobUrl: urls.customer.jobs(job._id),
    });
    return sendEmail({ to: artisan.email, ...template });
  },

  sendJobApplication: async (customer, artisan, job, application) => {
    const template = emailTemplates.jobApplication({
      customerName: customer.fullName || customer.name,
      artisanName: artisan.fullName || artisan.name,
      artisanProfession: artisan.profession || 'Artisan',
      artisanRating: artisan.averageRating || artisan.rating || 0,
      artisanReviews: artisan.totalReviews || artisan.reviewCount || 0,
      jobTitle: job.title,
      proposedRate: application.proposedRate,
      coverLetter: application.coverLetter,
      // FIXED: No /applications sub-route exists; link to job detail page
      applicationUrl: urls.customer.jobs(job._id),
    });
    return sendEmail({ to: customer.email, ...template });
  },

  sendBookingConfirmed: async (user, job, otherParty, role) => {
    const template = emailTemplates.bookingConfirmed({
      name: user.fullName || user.name,
      role,
      jobTitle: job.title,
      location: `${job.location ? job.location.city : ''}, ${job.location ? job.location.state : ''}`,
      scheduledDate: new Date(job.scheduledDate).toLocaleDateString('en-NG'),
      budget: job.budget,
      artisanName: otherParty ? (otherParty.fullName || otherParty.name) : '',
      customerName: otherParty ? (otherParty.fullName || otherParty.name) : '',
      jobUrl: role === 'customer' ? urls.customer.jobs(job._id) : urls.artisan.jobDetails(job._id),
    });
    return sendEmail({ to: user.email, ...template });
  },

  sendPaymentReceipt: async (user, transaction) => {
    const template = emailTemplates.paymentReceipt({
      name: user.fullName || user.name,
      amount: transaction.amount,
      reference: transaction.reference,
      date: new Date(transaction.createdAt).toLocaleDateString('en-NG'),
      status: transaction.status,
      // FIXED: Link to wallet instead of non-existent /payments/:id
      receiptUrl: user.role === 'artisan' ? urls.artisan.wallet : urls.customer.wallet,
    });
    return sendEmail({ to: user.email, ...template });
  },

  sendVerificationStatus: async (user, status, reason) => {
    const role = user.role || 'customer';
    const template = emailTemplates.verificationStatus({
      name: user.fullName || user.name,
      status,
      reason,
      // FIXED: Link to actual verification page
      profileUrl: role === 'artisan' ? urls.artisan.verification : urls.customer.verification,
    });
    return sendEmail({ to: user.email, ...template });
  },
};

module.exports = emailService;