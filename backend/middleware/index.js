// middleware/index.js
const authMiddleware = require('./authMiddleware');

// Defensive load of errorHandler
let errorHandler;
try {
  errorHandler = require('./errorHandler');
} catch (e) {
  console.warn('[Middleware] errorHandler.js not found, using fallback');
  errorHandler = (err, req, res, next) => {
    console.error('[Fallback ErrorHandler]', err);
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message || 'Server Error'
      }
    });
  };
}

// Defensive load of uploadMiddleware
let uploadMiddleware = {};
try {
  uploadMiddleware = require('./uploadMiddleware');
} catch (e) {
  console.warn('[Middleware] uploadMiddleware.js not found or missing dependency (multer?):', e.message);
}

module.exports = {
  ...authMiddleware,
  errorHandler,
  ...uploadMiddleware
};