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

const { errorHandler } = require('./middleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const artisanRoutes = require('./routes/artisanRoutes');
const jobRoutes = require('./routes/jobRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();

// ✅ FIXED: Trust proxy (required for Render to get client IP and secure cookies)
app.set('trust proxy', 1);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173', 'https://trustedhands.onrender.com']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ✅ FIXED: Simplified CORS - allow all origins in development, specific in production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://trustedhands.onrender.com',
      'https://trustedhands.onrender.com/'
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, curl, postman) OR from allowed origins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(allowed => origin?.includes(allowed))) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // ✅ CRITICAL: Must be true for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==========================================
// RATE LIMITING
// ==========================================

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests. Please try again later.'
    }
  },
  skip: (req) => req.path === '/health' || req.path === '/api'
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many auth attempts. Please try again later.'
    }
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// ==========================================
// BODY PARSING
// ==========================================

app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret'));

// ==========================================
// DATA SANITIZATION
// ==========================================

app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized key: ${key} from IP: ${req.ip}`);
  }
}));

app.use(xss());
app.use(hpp({
  whitelist: ['skills', 'status', 'category', 'sortBy']
}));

// ==========================================
// COMPRESSION & LOGGING
// ==========================================

app.use(compression({
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

// ==========================================
// HEALTH & API STATUS
// ==========================================

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TrustedHand API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'TrustedHand API v1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      artisans: '/api/artisans',
      jobs: '/api/jobs',
      payments: '/api/payments',
      chat: '/api/chat',
      applications: '/api/applications'
    }
  });
});

// ==========================================
// ROUTES
// ==========================================

console.log('📋 Registering routes...');

app.use('/api/auth', authRoutes);
console.log('✅ Auth routes at /api/auth');

app.use('/api/users', userRoutes);
console.log('✅ User routes at /api/users');

app.use('/api/artisans', artisanRoutes);
console.log('✅ Artisan routes at /api/artisans');

app.use('/api/jobs', jobRoutes);
console.log('✅ Job routes at /api/jobs');

app.use('/api/applications', applicationRoutes);
console.log('✅ Application routes at /api/applications');

app.use('/api/payments', paymentRoutes);
console.log('✅ Payment routes at /api/payments');

app.use('/api/chat', chatRoutes);
console.log('✅ Chat routes at /api/chat');

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
});

app.use(errorHandler);

module.exports = app;