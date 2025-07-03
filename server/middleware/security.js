const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const { User } = require('../database/models');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
        limit: max,
        remaining: 0,
        resetTime: new Date(Date.now() + windowMs).toISOString()
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  'Too many requests from this IP, please try again later'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // 20 attempts per 15 minutes
  'Too many authentication attempts, please try again later'
);

// AI endpoint rate limiting
const aiLimiter = createRateLimit(
  60 * 1000, // 1 minute
  parseInt(process.env.RATE_LIMIT_AI_MAX_REQUESTS) || 20,
  'AI request limit exceeded, please wait before making more requests'
);

// File upload rate limiting
const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  100, // 100 uploads per hour
  'Upload limit exceeded, please try again later'
);

// Password reset rate limiting
const passwordResetLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 attempts per hour
  'Too many password reset attempts, please try again later'
);

// Input validation middleware
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    req.body = value;
    next();
  };
};

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        timestamp: new Date().toISOString()
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid token. User not found.',
        timestamp: new Date().toISOString()
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account has been deactivated.',
        timestamp: new Date().toISOString()
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token has expired.',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token.',
        timestamp: new Date().toISOString()
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed.',
      timestamp: new Date().toISOString()
    });
  }
};

// Optional authentication (for public endpoints that benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.log('Optional auth failed:', error.message);
  }
  
  next();
};

// Permission check middleware
const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        timestamp: new Date().toISOString()
      });
    }

    // Admin users have all permissions
    if (req.user.subscription.plan === 'enterprise') {
      return next();
    }

    // Check specific permissions based on subscription plan
    const userPlan = req.user.subscription.plan;
    const permissions = {
      free: ['basic'],
      pro: ['basic', 'advanced'],
      team: ['basic', 'advanced', 'team'],
      enterprise: ['basic', 'advanced', 'team', 'admin']
    };

    if (!permissions[userPlan] || !permissions[userPlan].includes(permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions. Upgrade your plan to access this feature.',
        requiredPermission: permission,
        currentPlan: userPlan,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// File upload security middleware
const secureFileUpload = (req, res, next) => {
  if (!req.files) {
    return next();
  }

  const allowedTypes = (process.env.ALLOWED_FILE_TYPES || '').split(',');
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024; // 50MB default

  for (const file of Object.values(req.files)) {
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `File type ${file.mimetype} not allowed`,
        allowedTypes,
        timestamp: new Date().toISOString()
      });
    }

    // Check file size
    if (file.size > maxSize) {
      return res.status(413).json({
        error: `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`,
        fileSize: Math.round(file.size / 1024 / 1024),
        maxSize: Math.round(maxSize / 1024 / 1024),
        timestamp: new Date().toISOString()
      });
    }

    // Basic file content validation
    if (file.mimetype.startsWith('image/')) {
      // Check for valid image headers
      const imageHeaders = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/gif': [0x47, 0x49, 0x46],
        'image/webp': [0x52, 0x49, 0x46, 0x46]
      };

      const expectedHeader = imageHeaders[file.mimetype];
      if (expectedHeader) {
        const fileHeader = Array.from(file.data.slice(0, expectedHeader.length));
        if (!expectedHeader.every((byte, index) => byte === fileHeader[index])) {
          return res.status(400).json({
            error: 'Invalid file format. File header does not match declared type.',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  next();
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // For legacy browser support
};

// Security headers configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-eval'"], // unsafe-eval needed for dynamic code execution
      connectSrc: ["'self'", "wss:", "https:"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false // Disable for compatibility
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const userId = req.user ? req.user._id : 'Anonymous';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log only in development or for errors
    if (process.env.NODE_ENV === 'development' || statusCode >= 400) {
      console.log(`${method} ${url} ${statusCode} ${duration}ms - ${ip} - ${userId} - ${userAgent}`);
    }
  });

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: `${field} already exists`,
      field,
      timestamp: new Date().toISOString()
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      timestamp: new Date().toISOString()
    });
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      timestamp: new Date().toISOString()
    });
  }

  // CORS errors
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      timestamp: new Date().toISOString()
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
};

// API key validation middleware (for AI services)
const validateApiKey = (service) => {
  return (req, res, next) => {
    const envKey = `${service.toUpperCase()}_API_KEY`;
    if (!process.env[envKey]) {
      return res.status(503).json({
        error: `${service} service is not configured`,
        service,
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

// Health check middleware
const healthCheck = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      uptime: process.uptime(),
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        readyState: mongoose.connection.readyState
      },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      }
    };

    // Check database connectivity
    if (mongoose.connection.readyState !== 1) {
      health.status = 'unhealthy';
      return res.status(503).json(health);
    }

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  aiLimiter,
  uploadLimiter,
  passwordResetLimiter,
  
  // Authentication & authorization
  authenticateToken,
  optionalAuth,
  checkPermission,
  
  // Security middleware
  validateInput,
  secureFileUpload,
  validateApiKey,
  
  // Express middleware setup
  setupSecurity: (app) => {
    // Trust proxy (important for rate limiting behind reverse proxy)
    if (process.env.TRUST_PROXY === 'true') {
      app.set('trust proxy', 1);
    }

    // Compression
    if (process.env.ENABLE_COMPRESSION === 'true') {
      app.use(compression());
    }

    // Security headers
    if (process.env.ENABLE_HELMET === 'true') {
      app.use(helmet(helmetConfig));
    }

    // CORS
    app.use(cors(corsOptions));

    // Data sanitization against NoSQL query injection
    app.use(mongoSanitize());

    // Data sanitization against XSS
    app.use(xss());

    // Prevent HTTP Parameter Pollution
    app.use(hpp());

    // Request logging
    if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
      app.use(requestLogger);
    }

    // Health check endpoint
    app.get('/health', healthCheck);

    // Rate limiting
    app.use('/api/', generalLimiter);
    app.use('/api/auth/', authLimiter);
    app.use('/api/ai/', aiLimiter);
    app.use('/api/assets/upload', uploadLimiter);
    app.use('/api/auth/forgot-password', passwordResetLimiter);
    app.use('/api/auth/reset-password', passwordResetLimiter);
  },

  // Utility functions
  errorHandler,
  requestLogger,
  healthCheck
};