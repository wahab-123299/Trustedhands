const AppError = require('../utils/errorHandler').AppError;

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError('NOT_FOUND', message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = new AppError('USER_EXISTS', message, field);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.join(', ');
    const field = Object.keys(err.errors)[0];
    error = new AppError('VALIDATION_ERROR', message, field);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError('AUTH_UNAUTHORIZED', message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError('AUTH_TOKEN_EXPIRED', message);
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'SERVER_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: error.message || 'Server Error',
      field: error.field || null,
      details: error.details || null,
      suggestion: getSuggestion(errorCode)
    }
  });
};

// Helper function to get suggestions based on error code
function getSuggestion(code) {
  const suggestions = {
    'AUTH_INVALID_CREDENTIALS': 'Please check your email and password and try again.',
    'AUTH_TOKEN_EXPIRED': 'Please login again to continue.',
    'AUTH_UNAUTHORIZED': 'You may need to login or use a different account.',
    'USER_NOT_FOUND': 'Please check the user ID or email.',
    'USER_EXISTS': 'Try using a different email or phone number.',
    'USER_PHONE_EXISTS': 'Try using a different phone number.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'ARTISAN_NOT_FOUND': 'The artisan may have been removed or deactivated.',
    'ARTISAN_UNAVAILABLE': 'Try booking a different artisan or check back later.',
    'JOB_NOT_FOUND': 'The job may have been deleted or you do not have access.',
    'JOB_INVALID_STATUS': 'This action cannot be performed on this job at its current status.',
    'PAYMENT_FAILED': 'Please try again or use a different payment method.',
    'PAYMENT_INSUFFICIENT_FUNDS': 'Please use a different card or add funds to your account.',
    'PAYMENT_BANK_ERROR': 'Please contact your bank for assistance.',
    'CHAT_NOT_ALLOWED': 'You can only chat with users you have an active job with.',
    'SERVER_ERROR': 'Please try again later or contact support.'
  };

  return suggestions[code] || 'Please try again or contact support if the problem persists.';
}

module.exports = errorHandler;
