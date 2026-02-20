import dotenv from 'dotenv';
dotenv.config(); // Must be FIRST — env.js reads process.env on import

// ── Startup validation (fail-fast) ───────────────────────────────────────────
import './src/config/env.js'; // Validates all env vars, exits on failure
import { runStartupChecks } from './src/utils/startupChecks.js';
import { ensureIndexes } from './src/config/indexes.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import * as Sentry from '@sentry/node';
import { collectDefaultMetrics, Registry, Counter, Histogram, Gauge } from 'prom-client';

import { connectMongoDB } from './src/config/mongodb.js';
import { connectRedis, redis } from './src/utils/redis.js';
import { csrfProtection, setCsrfToken } from './src/middleware/csrf.js';
import { businessMetrics } from './src/utils/businessMetrics.js';
import logger from './src/utils/logger.js';

import authRoutes from './src/routes/auth-jwt.js';
import caseRoutes from './src/routes/cases.js';
import clientRoutes from './src/routes/clients.js';
import alertRoutes from './src/routes/alerts.js';
import timeEntryRoutes from './src/routes/timeEntries.js';
import legalSectionRoutes from './src/routes/legalSections.js';
import documentsRoutes from './src/routes/documents.js';
import invoiceRoutes from './src/routes/invoices.js';
import hearingRoutes from './src/routes/hearings.js';
import dashboardRoutes from './src/routes/dashboard.js';
import twoFactorRoutes from './src/routes/twoFactor.js';
import adminRoutes from './src/routes/admin.js';
import { requestId } from './src/middleware/requestId.js';

// dotenv already loaded at top — do not call again

// ─── Sentry Initialisation (no-ops if DSN not set) ───────────────────────────
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '1.0.0',
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ],
});

// ─── Prometheus Metrics Setup ─────────────────────────────────────────────────
const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const rateLimitCounter = new Counter({
  name: 'rate_limit_triggered_total',
  help: 'Total number of rate limit events',
  labelNames: ['limiter'],
  registers: [metricsRegistry],
});

const app = express();

// ─── Trust Proxy (Railway / Render / any reverse proxy) ───────────────────────
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production';
const frontendOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ─── 1. Helmet — Hardened Security Headers ────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Remove unsafe-inline in production — use a nonce if needed for 3rd-party scripts
        scriptSrc: isProduction
          ? ["'self'"]
          : ["'self'", "'unsafe-inline'"],            // Vite HMR in dev only
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://cloudinary.com',
          'https://*.gravatar.com',
        ],
        connectSrc: [
          "'self'",
          frontendOrigin,
          'https://res.cloudinary.com',
          'https://api.cloudinary.com',
          'wss://localhost:*',                         // Vite HMR websocket
          ...(process.env.SENTRY_DSN ? ['https://sentry.io', 'https://*.sentry.io'] : []),
        ],
        mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    hsts: isProduction
      ? { maxAge: 63072000, includeSubDomains: true, preload: true } // 2 years
      : false,
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    permittedCrossDomainPolicies: false,
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (() => {
  const configured = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',').map(o => o.trim()).filter(Boolean);
  const devOrigins = isProduction ? [] : ['http://localhost:5173', 'http://localhost:8080'];
  return [...new Set([...configured, ...devOrigins])];
})();

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // server-to-server / curl
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    logger.warn({ origin }, 'CORS blocked origin');
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ─── NoSQL Injection Protection ───────────────────────────────────────────────
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitizeError: (req) => {
    logger.warn({ path: req.path }, 'MongoDB sanitize: blocked malicious input');
  },
}));

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Structured Logging (Pino) + Request ID Correlation ──────────────────────
app.use(requestId);  // Sets req.requestId + X-Request-Id header
app.use(pinoHttp({ logger, genReqId: (req) => req.requestId }));


// ─── Prometheus Request Duration Tracking ────────────────────────────────────
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
  });
  next();
});

// Sentry v8+: request tracing is handled automatically by httpIntegration() in Sentry.init()
// expressRequestHandler() and expressTracingHandler() were removed in v8

// ─── CSRF Protection ─────────────────────────────────────────────────────────
// Applied globally; exempt patterns are handled inside the middleware
app.use(csrfProtection);

// ─── Rate Limiters (Redis-backed in production, memory fallback in dev) ───────
function buildRateLimiter({ windowMs, max, message, limiterName, skip }) {
  const storeOptions = redis.isAvailable()
    ? {
      store: new RedisStore({
        sendCommand: (...args) => redis.raw()?.call(...args),
        prefix: `rl:${limiterName}:`,
      }),
    }
    : {};

  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    skip: skip || (() => false),
    handler(req, res, next, options) {
      // Track in Prometheus
      rateLimitCounter.inc({ limiter: limiterName });
      logger.warn({ ip: req.ip, path: req.path, limiter: limiterName }, 'Rate limit triggered');
      res.status(options.statusCode).json(options.message);
    },
    ...storeOptions,
  });
}

const globalLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.',
  limiterName: 'global',
  skip: (req) => !isProduction && req.ip === '::1',
});

const authLimiter = buildRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts, please try again in 15 minutes.',
  limiterName: 'auth',
});

const uploadLimiter = buildRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: 'Too many file upload requests, please try again later.',
  limiterName: 'uploads',
});

app.use(globalLimiter);

// ─── System Routes ────────────────────────────────────────────────────────────
app.get('/favicon.ico', (_req, res) => res.status(204).end());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'lawgpt-api',
    version: process.env.npm_package_version || '1.0.0',
    docs: '/api/v1/health',
  });
});

// Enhanced health check
app.get('/api/v1/health', async (_req, res) => {
  const redisStatus = redis.isAvailable() ? 'connected' : 'fallback (in-memory)';
  let redisPing = 'N/A';
  try { redisPing = await redis.ping(); } catch { /* ignore */ }

  res.json({
    ok: true,
    service: 'lawgpt-api',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    redis: { status: redisStatus, ping: redisPing },
    uptime: process.uptime(),
  });
});

// Prometheus metrics endpoint (restrict in production to internal access if needed)
app.get('/api/v1/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// CSRF token issuance endpoint
app.get('/api/v1/auth/csrf-token', setCsrfToken);
app.get('/api/auth/csrf-token', setCsrfToken);

// ─── Strict Auth Rate Limiters (applied before route handlers) ────────────────
['login', 'register', 'forgot-password'].forEach(route => {
  app.use(`/api/v1/auth/${route}`, authLimiter);
  app.use(`/api/auth/${route}`, authLimiter);
});

// Upload limiter applied to document upload routes
app.use('/api/v1/documents', uploadLimiter);
app.use('/api/documents', uploadLimiter);

// ─── API v1 Routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', caseRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/time-entries', timeEntryRoutes);
app.use('/api/v1/legal-sections', legalSectionRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/hearings', hearingRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/2fa', twoFactorRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── Backward Compatibility /api/* → /api/v1/* (90-day window) ───────────────
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/legal-sections', legalSectionRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/hearings', hearingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── Static uploads (legacy) ─────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Sentry Error Handler (must be before custom error handler) ───────────────
// Sentry v8+ error handler — must be before other error handlers
if (process.env.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);


// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `${req.method} ${req.path} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: 'CORS Error', message: 'Request blocked by CORS policy' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Internal Server Error',
    message: isProduction ? 'An error occurred' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
let currentServer = null;

async function startServer() {
  try {
    // ── 1. Security checks (TLS, secrets, CORS) ──────────────────────────────────
    runStartupChecks();

    // ── 2. Connect Redis (non-blocking — falls back gracefully) ─────────────────
    await connectRedis();

    // ── 3. Connect MongoDB ────────────────────────────────────────────────────────
    await connectMongoDB();
    logger.info('MongoDB connected');

    // ── 4. Ensure all performance indexes exist ───────────────────────────────────
    await ensureIndexes();

    currentServer = app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV }, '🚀 LawGPT API started');
    });

    currentServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error({ port: PORT }, 'Port already in use');
      } else {
        logger.error({ error }, 'Server error');
      }
      process.exit(1);
    });

    // ── Graceful Shutdown ────────────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      logger.info({ signal }, 'Graceful shutdown initiated');

      if (currentServer) {
        currentServer.close(() => logger.info('HTTP server closed'));
      }

      // Allow in-flight requests to finish (max 5s)
      await new Promise(resolve => setTimeout(resolve, Math.min(parseInt(process.env.SHUTDOWN_TIMEOUT || '2000', 10), 5000)));

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
    process.once('SIGUSR2', async () => {
      await gracefulShutdown('SIGUSR2');
      process.kill(process.pid, 'SIGUSR2');
    });

    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught Exception');
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled Rejection');
    });

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();
