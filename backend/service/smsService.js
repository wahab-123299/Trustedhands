const axios = require('axios');

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'TrustedHand';
const TERMII_BASE_URL = 'https://api.ng.termii.com/api';

const formatPhone = (phone) => {
  // Convert 09123456789 to +2349123456789
  if (phone.startsWith('0')) return `+234${phone.slice(1)}`;
  if (phone.startsWith('234')) return `+${phone}`;
  if (!phone.startsWith('+')) return `+234${phone}`;
  return phone;
};

const sendSMS = async ({ to, message }) => {
  try {
    if (!TERMII_API_KEY) {
      console.warn('TERMII_API_KEY not set. SMS not sent.');
      return { success: false, error: 'SMS provider not configured' };
    }

    const response = await axios.post(`${TERMII_BASE_URL}/sms/send`, {
      to: formatPhone(to),
      from: TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: TERMII_API_KEY
    });

    console.log('SMS sent:', response.data.message_id);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('SMS failed:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

// SMS Templates
const smsTemplates = {
  welcome: (data) => ({
    message: `Welcome to TrustedHand, ${data.name}! Your registration was successful. Find skilled artisans or grow your business with us.`
  }),
  
  newBooking: (data) => ({
    message: `TrustedHand: Hi ${data.artisanName}, ${data.customerName} wants to book you for "${data.jobTitle}" (Budget: ₦${data.budget.toLocaleString()}). Login to respond: ${data.shortUrl}`
  }),
  
  bookingConfirmed: (data) => ({
    message: `TrustedHand: Great news! ${data.artisanName} has accepted your booking for "${data.jobTitle}". Date: ${data.scheduledDate}. Contact: ${data.artisanPhone}`
  }),
  
  newJobAlert: (data) => ({
    message: `TrustedHand: New job alert! "${data.jobTitle}" in ${data.location} (Budget: ₦${data.budget.toLocaleString()}). Apply: ${data.shortUrl}`
  }),
  
  jobStarted: (data) => ({
    message: `TrustedHand: ${data.artisanName} has started your job "${data.jobTitle}". Track progress on the app.`
  }),
  
  jobCompleted: (data) => ({
    message: `TrustedHand: "${data.jobTitle}" is completed! Please confirm and review ${data.artisanName}.`
  }),
  
  paymentReceived: (data) => ({
    message: `TrustedHand: Payment of ₦${data.amount.toLocaleString()} received for "${data.jobTitle}". Check your wallet.`
  })
};

module.exports = {
  sendSMS,
  smsTemplates
};