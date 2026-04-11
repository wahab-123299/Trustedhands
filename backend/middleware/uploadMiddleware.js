const multer = require('multer');
const { AppError } = require('../utils/errorHandler');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('VALIDATION_ERROR', 'Only image files are allowed'), false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
    files: 6 // Maximum 6 files
  }
});

// Upload single file
exports.uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('VALIDATION_ERROR', 'File size too large. Maximum size is 2MB.'));
        }
        return next(new AppError('VALIDATION_ERROR', err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  };
};

// Upload multiple files
exports.uploadMultiple = (fieldName, maxCount) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('VALIDATION_ERROR', 'File size too large. Maximum size is 2MB per file.'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError('VALIDATION_ERROR', `Maximum ${maxCount} files allowed.`));
        }
        return next(new AppError('VALIDATION_ERROR', err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  };
};

// Upload mixed fields
exports.uploadFields = (fields) => {
  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError('VALIDATION_ERROR', 'File size too large. Maximum size is 2MB per file.'));
        }
        return next(new AppError('VALIDATION_ERROR', err.message));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  };
};
