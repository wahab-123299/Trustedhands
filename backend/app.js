const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

const { errorHandler } = require('./middleware');
const {
  authRoutes,
  userRoutes,
  artisanRoutes,
  jobRoutes,
  paymentRoutes,
  chatRoutes,
  applicationRoutes
} = require('./routes');

const app = express();

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet with custom configuration for API
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173']
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedded resources
}));

// CORS configuration - MUST allow credentials
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000'
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // THIS IS CRITICAL - allows cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
}));

// ==========================================
// RATE LIMITING (Different tiers)
// ==========================================

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  // Skip successful requests for health checks
  skip: (req) => req.path === '/health'
});
app.use('/api/', generalLimiter);

// Stricter rate limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.'
    }
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// ==========================================
// BODY PARSING
// ==========================================

// Body parser with size limits
app.use(express.json({ 
  limit: '10mb',
  strict: true // Only accept arrays and objects
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000 // Limit number of form fields
}));

// Cookie parser with secret for signed cookies (optional)
app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret-change-in-production'));

// ==========================================
// DATA SANITIZATION
// ==========================================

// Data sanitization against NoSQL query injection
app.use(mongoSanitize({
  replaceWith: '_', // Replace prohibited characters with underscore
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key: ${key} from IP: ${req.ip}`);
  }
}));

// Data sanitization against XSS
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp({
  whitelist: [ // Allow these parameters to have multiple values
    'skills',
    'status',
    'category',
    'sortBy'
  ]
}));

// ==========================================
// COMPRESSION & LOGGING
// ==========================================

// Compression (gzip)
app.use(compression({
  level: 6, // Balance between compression and CPU usage
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false; // Don't compress responses with this header
    }
    return compression.filter(req, res);
  }
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Production logging (can be extended to use Winston)
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400 // Only log errors in production
  }));
}

// ==========================================
// STATIC FILES (if needed)
// ==========================================

// Serve uploaded files (if storing locally - better to use Cloudinary)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// HEALTH & API STATUS
// ==========================================

// Health check endpoint (no rate limit)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TrustedHand API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'TrustedHand API v1.0.0',
    documentation: '/api/docs', // If you add Swagger later
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      artisans: '/api/artisans',
      jobs: '/api/jobs',
      payments: '/api/payments',
      chat: '/api/chat'
    }
  });
});

// ==========================================
// ROUTES
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/artisans', artisanRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes); // ✅ Add this
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      suggestion: 'Check the API documentation for available endpoints'
    }
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;