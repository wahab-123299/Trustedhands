const authMiddleware = require('./authMiddleware');
const errorHandler = require('./errorHandler');
const uploadMiddleware = require('./uploadMiddleware');

module.exports = {
  ...authMiddleware,
  errorHandler,
  ...uploadMiddleware
};
