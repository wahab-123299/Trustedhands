const { AppError } = require('../utils/errorHandler');


exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('FORBIDDEN', 'Admin access required'));
  }
  next();
};

