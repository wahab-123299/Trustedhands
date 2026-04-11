const nodemailer = require('nodemailer');

// Create transporter with better error handling
const createTransporter = async () => {
  // For production, use SMTP or SendGrid
  if (process.env.NODE_ENV === 'production') {
    // Validate required environment variables
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Missing SMTP configuration. Please check environment variables.');
      return null;
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates in dev
      }
    });
  }

  // For development, use ethereal.email (test account)
  try {
    // Create test account if credentials not provided
    if (!process.env.ETHEREAL_USER || !process.env.ETHEREAL_PASS) {
      console.log('Creating Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS
      }
    });
  } catch (error) {
    console.error('Failed to create test account:', error);
    return null;
  }
};

// Send email with retry logic
exports.sendEmail = async (options, retries = 3) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const transporter = await createTransporter();
      
      if (!transporter) {
        throw new Error('Email transporter not available');
      }

      const message = {
        from: `${process.env.FROM_NAME || 'TrustedHand'} <${process.env.FROM_EMAIL || 'noreply@trustedhand.com'}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
        attachments: options.attachments || []
      };

      const info = await transporter.sendMail(message);

      console.log(`Email sent to ${options.to}:`, info.messageId);

      // For development, log the preview URL
      if (process.env.NODE_ENV !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log('Preview URL:', previewUrl);
        return { success: true, messageId: info.messageId, previewUrl };
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      console.error(`Email attempt ${i + 1} failed:`, error.message);
      
      if (i < retries - 1) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  // All retries failed
  console.error('All email retries failed:', lastError);
  
  // In production, you might want to send to a dead letter queue or alert admin
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_EMAIL) {
    // Send alert to admin about email failure
    console.error(`CRITICAL: Failed to send email to ${options.to}. Subject: ${options.subject}`);
  }
  
  return { success: false, error: lastError.message };
};

// Helper to strip HTML for text version
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Send welcome email
exports.sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to TrustedHand!';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to TrustedHand</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
        <p style="color: #6B7280; margin: 5px 0;">Nigeria's Trusted Marketplace for Skilled Artisans</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
        <h2 style="color: #10B981; margin-top: 0;">Welcome, ${user.fullName}!</h2>
        <p>Thank you for joining TrustedHand. We're excited to have you on board!</p>
        
        <p>With TrustedHand, you can ${user.role === 'customer' ? ':' : 'showcase your skills and:'}</p>
        <ul style="padding-left: 20px;">
          ${user.role === 'customer' ? `
          <li>Find verified artisans for your home repairs and maintenance</li>
          <li>Book services with secure escrow payments</li>
          <li>Chat directly with artisans in real-time</li>
          <li>Rate and review completed services</li>
          ` : `
          <li>Connect with customers looking for your skills</li>
          <li>Receive secure payments through our escrow system</li>
          <li>Build your reputation with customer reviews</li>
          <li>Grow your business with verified leads</li>
          `}
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/${user.role === 'customer' ? 'artisans' : 'artisan/dashboard'}" 
             style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Get Started
          </a>
        </div>
        
        <p style="margin-bottom: 0;">If you have any questions, reply to this email or contact our support team.</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
        <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
        <p>Lagos, Nigeria</p>
      </div>
    </body>
    </html>
  `;

  return await exports.sendEmail({
    to: user.email,
    subject,
    html
  });
};

// Send email verification
exports.sendVerificationEmail = async (user, verificationUrl) => {
  const subject = 'Verify Your Email Address';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
        <h2 style="color: #10B981; margin-top: 0;">Verify Your Email</h2>
        <p>Hi ${user.fullName},</p>
        <p>Thank you for registering with TrustedHand. Please click the button below to verify your email address:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6B7280; font-size: 14px;">${verificationUrl}</p>
        
        <p style="color: #EF4444; font-weight: bold;">This link expires in 24 hours.</p>
        
        <p>If you didn't create an account with TrustedHand, please ignore this email.</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
        <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return await exports.sendEmail({
    to: user.email,
    subject,
    html
  });
};

// Send password reset email
exports.sendPasswordResetEmail = async (user, resetUrl) => {
  const subject = 'Password Reset Request';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
        <h2 style="color: #10B981; margin-top: 0;">Password Reset</h2>
        <p>Hi ${user.fullName},</p>
        <p>You requested a password reset for your TrustedHand account. Click the button below to reset your password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p>Or copy and paste this link:</p>
        <p style="word-break: break-all; color: #6B7280; font-size: 14px;">${resetUrl}</p>
        
        <p style="color: #EF4444; font-weight: bold;">This link expires in 1 hour.</p>
        
        <p>If you didn't request this reset, please ignore this email or contact support if you're concerned.</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
        <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return await exports.sendEmail({
    to: user.email,
    subject,
    html
  });
};

// Send job notification email
exports.sendJobNotification = async (user, job, type) => {
  const templates = {
    new_job: {
      subject: 'New Job Request',
      title: 'New Job Request',
      message: 'You have a new job request:',
      actionText: 'View Job',
      actionUrl: `${process.env.FRONTEND_URL}/artisan/jobs/${job._id}`
    },
    job_accepted: {
      subject: 'Job Accepted',
      title: 'Job Accepted',
      message: 'Your job request has been accepted:',
      actionText: 'Make Payment',
      actionUrl: `${process.env.FRONTEND_URL}/customer/jobs/${job._id}`,
      extraMessage: 'Please proceed to make payment to confirm the booking.'
    },
    job_started: {
      subject: 'Job Started',
      title: 'Job Started',
      message: 'The artisan has started working on your job:',
      actionText: 'View Progress',
      actionUrl: `${process.env.FRONTEND_URL}/customer/jobs/${job._id}`
    },
    job_completed: {
      subject: 'Job Completed',
      title: 'Job Completed',
      message: 'The artisan has completed the job:',
      actionText: 'Confirm & Review',
      actionUrl: `${process.env.FRONTEND_URL}/customer/jobs/${job._id}`,
      extraMessage: 'Please confirm completion and leave a review.'
    },
    payment_received: {
      subject: 'Payment Received',
      title: 'Payment Received',
      message: 'You have received a payment for:',
      actionText: 'View Wallet',
      actionUrl: `${process.env.FRONTEND_URL}/artisan/wallet`
    }
  };

  const template = templates[type];
  if (!template) {
    console.error(`Unknown email template type: ${type}`);
    return { success: false, error: 'Unknown template type' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${template.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
        <h2 style="color: #10B981; margin-top: 0;">${template.title}</h2>
        <p>Hi ${user.fullName},</p>
        <p>${template.message}</p>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10B981;">
          <h3 style="margin-top: 0; color: #111827;">${job.title}</h3>
          <p style="margin: 5px 0;"><strong>Budget:</strong> ₦${job.budget?.toLocaleString() || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${job.location?.city || 'N/A'}, ${job.location?.state || 'N/A'}</p>
          ${job.scheduledDate ? `<p style="margin: 5px 0;"><strong>Scheduled:</strong> ${new Date(job.scheduledDate).toLocaleDateString('en-NG')}</p>` : ''}
        </div>
        
        ${template.extraMessage ? `<p>${template.extraMessage}</p>` : ''}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${template.actionUrl}" 
             style="display: inline-block; padding: 12px 30px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            ${template.actionText}
          </a>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
        <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  return await exports.sendEmail({
    to: user.email,
    subject: template.subject,
    html
  });
};

// Send payment receipt
exports.sendPaymentReceipt = async (user, transaction) => {
  const subject = 'Payment Receipt - TrustedHand';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #10B981; margin: 0;">TrustedHand</h1>
        <p style="color: #6B7280;">Payment Receipt</p>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 8px;">
        <h2 style="color: #10B981; margin-top: 0;">Thank You for Your Payment!</h2>
        <p>Hi ${user.fullName},</p>
        <p>Your payment has been successfully processed.</p>
        
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Transaction Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Reference:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${transaction.paystackReference}</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">₦${transaction.amount?.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Platform Fee:</td>
              <td style="padding: 8px 0; text-align: right;">₦${transaction.platformFee?.toLocaleString()}</td>
            </tr>
            <tr style="border-top: 2px solid #10B981;">
              <td style="padding: 8px 0; color: #6B7280; font-weight: bold;">Artisan Receives:</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10B981;">₦${transaction.artisanAmount?.toLocaleString()}</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; color: #6B7280;">Date:</td>
              <td style="padding: 8px 0; text-align: right;">${new Date(transaction.paidAt || Date.now()).toLocaleString('en-NG')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Status:</td>
              <td style="padding: 8px 0; text-align: right; color: #10B981; font-weight: bold; text-transform: uppercase;">${transaction.status}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 12px; color: #6B7280; margin-top: 20px;">
          The artisan will receive payment once you confirm job completion. 
          If there are any issues, please contact our support team within 48 hours.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #9CA3AF; font-size: 12px;">
        <p>© ${new Date().getFullYear()} TrustedHand. All rights reserved.</p>
        <p>Questions? Contact support@trustedhand.com</p>
      </div>
    </body>
    </html>
  `;

  return await exports.sendEmail({
    to: user.email,
    subject,
    html
  });
};