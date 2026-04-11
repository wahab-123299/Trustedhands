const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const artisanRoutes = require('./artisanRoutes');
const jobRoutes = require('./jobRoutes');
const paymentRoutes = require('./paymentRoutes');
const chatRoutes = require('./chatRoutes');
const applicationRoutes = require('./applicationRoutes'); // ✅ Changed to match pattern

module.exports = {
  authRoutes,
  userRoutes,
  artisanRoutes,
  jobRoutes,
  paymentRoutes,
  chatRoutes,
  applicationRoutes
};