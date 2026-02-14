import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectMongoDB } from './src/config/mongodb.js';
import authRoutes from './src/routes/auth-jwt.js'; // JWT-based authentication
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
import path from 'path';

dotenv.config();

const app = express();

// CORS configuration - Enterprise Grade
const corsOptions = {
  origin: function (origin, callback) {
    // Support multiple origins from environment variable
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const allowedOrigins = corsOrigin.split(',').map(o => o.trim()).filter(o => o.length > 0);

    // Always allow both Vite (5173) and legacy (8080) in development
    const developmentOrigins = ['http://localhost:5173', 'http://localhost:8080'];
    const allAllowedOrigins = [...new Set([...allowedOrigins, ...developmentOrigins])];

    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 CORS check - Origin:', origin);
      console.log('✅ CORS - Allowed origins:', allAllowedOrigins);
    }

    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CORS: Allowing request with no origin');
      }
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allAllowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CORS: Allowing origin:', origin);
      }
      callback(null, true);
    } else {
      console.error('❌ CORS blocked origin:', origin);
      console.error('💡 Allowed origins:', allAllowedOrigins);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Handle favicon requests (browsers automatically request this)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content - stops browser from requesting again
});

// Root route
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'lawyer-zen-api',
    message: 'API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      cases: '/api/cases',
      clients: '/api/clients',
      documents: '/api/documents',
      invoices: '/api/invoices',
      hearings: '/api/hearings',
      alerts: '/api/alerts',
      timeEntries: '/api/time-entries',
      dashboard: '/api/dashboard',
      legalSections: '/api/legal-sections',
      twoFactor: '/api/2fa'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'lawyer-zen-api' });
});

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

// Serve uploads (legacy support - files now stored in Cloudinary)
// This route is kept for backward compatibility with old files
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: {
      health: '/api/health',
      auth: '/api/auth',
      cases: '/api/cases',
      clients: '/api/clients',
      documents: '/api/documents',
      invoices: '/api/invoices',
      hearings: '/api/hearings',
      alerts: '/api/alerts',
      timeEntries: '/api/time-entries',
      dashboard: '/api/dashboard',
      legalSections: '/api/legal-sections'
    }
  });
});

// Global error handler - Enterprise Grade
app.use((err, req, res, next) => {
  // Log error details
  console.error('❌ Error:', err.message);
  console.error('📍 Path:', req.method, req.path);
  if (process.env.NODE_ENV === 'development') {
    console.error('🔍 Stack:', err.stack);
  }

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle specific error types
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS Error',
      message: isProduction ? 'Request blocked by CORS policy' : err.message
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: isProduction ? 'An error occurred' : err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
});

const PORT = process.env.PORT || 5000;
let currentServer = null; // Track current server instance

// Initialize MongoDB Atlas connection
async function startServer() {
  try {
    // Force cleanup any existing connections on this port
    if (currentServer) {
      console.log('⚠️  Cleaning up previous server instance...');
      try {
        currentServer.close();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log('   (Previous server already closed)');
      }
    }

    // Connect to MongoDB
    await connectMongoDB();
    console.log('✅ MongoDB Atlas connection successful');

    // Start Express server with error handling
    currentServer = app.listen(PORT, () => {
      console.log(`\n🚀 Server started successfully!`);
      console.log(`📍 API listening on port ${PORT}`);
      console.log(`🗄️  Database: MongoDB Atlas`);
      console.log(`☁️  File Storage: Cloudinary`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health\n`);
    });

    // Handle server errors (including EADDRINUSE)
    currentServer.on('error', async (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
        console.error('\n💡 Solution:');
        console.error('   1. Close the other terminal running backend');
        console.error('   2. Or run: .\\kill-port-5000.bat');
        console.error('   3. Or run: npm run kill-port');
        console.error('   4. Then restart: npm run dev\n');
        currentServer = null;
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // Graceful shutdown handlers - Fixes Windows port occupation issue
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Starting graceful shutdown...`);

      if (!currentServer) {
        console.log('✅ No active server to close');
        process.exit(0);
        return;
      }

      // Close server immediately and forcefully
      currentServer.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Set a timeout to force exit if graceful shutdown takes too long
      const forceExit = setTimeout(() => {
        console.log('⚠️  Forcing process exit...');
        process.exit(0);
      }, 2000);

      // Close database connection
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ Database connections closed');
      } catch (error) {
        console.error('❌ Error closing database:', error.message);
      }

      clearTimeout(forceExit);
      currentServer = null;
      console.log('👋 Server shutdown complete. Port freed successfully!\n');
      process.exit(0);
    };

    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle termination signal (SIGTERM)
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle Windows Ctrl+Break
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));

    // Handle nodemon restart signal (SIGUSR2)
    process.once('SIGUSR2', async () => {
      await gracefulShutdown('SIGUSR2 (nodemon restart)');
      process.kill(process.pid, 'SIGUSR2');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your MONGODB_URI in .env file');
    console.error('   2. Verify MongoDB Atlas cluster is running');
    console.error('   3. Ensure network access is configured (IP whitelist)');
    console.error('   4. Check your MongoDB credentials\n');
    process.exit(1);
  }
}

// Start the server
startServer();
