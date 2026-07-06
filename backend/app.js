// backend/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://trustedhand.org',
    'https://www.trustedhand.org',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-keep-alive']
}));

// ==========================================
// BODY PARSING
// ==========================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ==========================================
// LOGGING
// ==========================================

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ==========================================
// HEALTH CHECK ROUTE (MUST BE BEFORE AUTH)
// ==========================================

app.use('/api/health', require('./routes/healthRoutes'));

// ==========================================
// API ROUTES
// ==========================================

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/artisans', require('./routes/artisanRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/availability', require('./routes/availabilityRoutes'));
app.use('/api/press', require('./routes/pressRoutes')); // ← NEW: Dynamic Press & Media

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);

  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'SERVER_ERROR',
        message: err.message,
        field: err.field || null,
        details: err.details || null
      }
    });
  }

  // Unexpected errors
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : err.message
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
});

module.exports = app;