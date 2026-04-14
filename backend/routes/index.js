// routes/index.js
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const artisanRoutes = require('./artisanRoutes');
const jobRoutes = require('./jobRoutes');
const paymentRoutes = require('./paymentRoutes');
const chatRoutes = require('./chatRoutes');
const applicationRoutes = require('./applicationRoutes');

// Export with explicit names to match app.js expectations
module.exports = {
  authRoutes: authRoutes,
  userRoutes: userRoutes,
  artisanRoutes: artisanRoutes,
  jobRoutes: jobRoutes,
  paymentRoutes: paymentRoutes,
  chatRoutes: chatRoutes,
  applicationRoutes: applicationRoutes
};