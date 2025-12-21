// backend/middleware/errorMiddleware.js

/**
 * @desc   Handle routes that don't exist
 */
export const notFound = (req, res, next) => {
  const error = new Error(`🔍 Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * @desc   Centralized error handler
 */
export const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code is set
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    // Show stack trace only in development
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};
