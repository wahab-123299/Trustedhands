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
const verificationRoutes = require('./routes/verificationRoutes');
const mongoose = require('mongoose');

const { errorHandler } = require('./middleware');

const app = express();

app.set('trust proxy', 1);

require('./cron/autoRelease');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173', 'https://trustedhands.onrender.com', 'http://localhost:5173', 'http://localhost:3000', 'wss://trustedhands.onrender.com']
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ==========================================
// CORS — FIXED FOR RENDER/NETLIFY PROXY
// ==========================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://trustedhand.netlify.app',
  'https://trustedhands.onrender.com',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    console.log('[CORS] Request from origin:', origin || 'undefined');

    if (!origin) {
      console.log('[CORS] Allowed (no origin)');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] Allowed:', origin);
      return callback(null, true);
    }

    console.log('[CORS] Blocked:', origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
// DEBUG LOGGING FOR OAUTH
// ==========================================
app.use((req, res, next) => {
  if (req.path.includes('auth') || req.path.includes('facebook') || req.path.includes('google')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
      query: req.query,
      origin: req.headers.origin,
      referer: req.headers.referer
    });
  }
  next();
});

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

  const isResponding = dbState === 1 || dbState === 2;

  res.status(isResponding ? 200 : 503).json({
    success: dbState === 1,
    status: isResponding ? 'healthy' : 'unhealthy',
    message: 'TrustedHand API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      connected: dbState === 1,
      state: dbState
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  });
});

// ==========================================
// PRIVACY & TERMS ROUTES (Required by Facebook)
// ==========================================
app.get('/privacy', (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>Last updated: May 2026</p>
    <p>TrustedHand respects your privacy. We collect only the information necessary to provide our services.</p>
    <p>We do not sell or share your personal data with third parties.</p>
    <p>For questions, contact: trustedhand100@gmail.com</p>
  `);
});

app.get('/terms', (req, res) => {
  res.send(`
    <h1>Terms of Service</h1>
    <p>Last updated: May 2026</p>
    <p>By using TrustedHand, you agree to these terms.</p>
    <p>Users must be 18 years or older to use this service.</p>
    <p>TrustedHand is not responsible for disputes between users and artisans.</p>
  `);
});

app.get('/data-deletion', (req, res) => {
  res.send(`
    <h1>Data Deletion Instructions</h1>
    <p>To request deletion of your data:</p>
    <ol>
      <li>Log into your TrustedHand account</li>
      <li>Go to Settings → Account</li>
      <li>Click "Delete Account"</li>
      <li>Confirm deletion</li>
    </ol>
    <p>Or email: trustedhand100@gmail.com</p>
  `);
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
app.use('/api/verification', verificationRoutes);

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