// Custom App Error class
class AppError extends Error {
  constructor(code, message, field = null, details = null) {
    super(message);
    this.code = code;
    this.field = field;
    this.details = details;
    this.statusCode = getStatusCode(code);
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Get HTTP status code based on error code
function getStatusCode(code) {
  const statusCodes = {
    'AUTH_INVALID_CREDENTIALS': 401,
    'AUTH_TOKEN_EXPIRED': 401,
    'AUTH_UNAUTHORIZED': 403,
    'USER_NOT_FOUND': 404,
    'USER_EXISTS': 409,
    'USER_PHONE_EXISTS': 409,
    'VALIDATION_ERROR': 400,
    'ARTISAN_NOT_FOUND': 404,
    'ARTISAN_UNAVAILABLE': 400,
    'JOB_NOT_FOUND': 404,
    'JOB_INVALID_STATUS': 400,
    'PAYMENT_FAILED': 400,
    'PAYMENT_INSUFFICIENT_FUNDS': 400,
    'PAYMENT_BANK_ERROR': 400,
    'CHAT_NOT_ALLOWED': 403,
    'NOT_FOUND': 404,
    'SERVER_ERROR': 500
  };

  return statusCodes[code] || 500;
}

module.exports = {
  AppError,
  getStatusCode
};
