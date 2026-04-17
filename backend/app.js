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
const mongoose = require('mongoose');

const { errorHandler } = require('./middleware');

const app = express();

// ✅ Trust proxy (required for Render)
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
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173', 'https://trustedhands.onrender.com', 'http://localhost:5173', 'http://localhost:3000']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ==========================================
// CORS CONFIGURATION - FIXED
// ==========================================
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://trustedhand.netlify.app',      // Your Netlify frontend
      'https://trustedhands.onrender.com',   // No space!
      process.env.FRONTEND_URL,
      undefined // Allow requests with no origin
    ].filter(Boolean);
    
    console.log('[CORS] Request from origin:', origin);
    console.log('[CORS] Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like curl, Postman, or same-origin requests)
    if (!origin) {
      console.log('[CORS] Allowed (no origin)');
      callback(null, true);
    } else if (allowedOrigins.includes(origin)) {
      console.log('[CORS] Allowed:', origin);
      callback(null, true);
    } else {
      console.log('[CORS] Blocked:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
    // ✅ REMOVED: Duplicate callback that was causing errors
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400
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

app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret-change-in-production'));

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
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbState] || 'unknown';

  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: 'TrustedHand API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    uptime: process.env.uptime(),
    database: {
      status: dbStatus,
      connected: dbState === 1
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
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

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/artisans', require('./routes/artisanRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

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