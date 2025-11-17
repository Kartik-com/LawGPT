import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { initializeFirebase } from './src/config/firebase.js';
import authRoutes from './src/routes/auth-firebase.js';
import caseRoutes from './src/routes/cases.js';
import clientRoutes from './src/routes/clients.js';
import alertRoutes from './src/routes/alerts.js';
import timeEntryRoutes from './src/routes/timeEntries.js';
import legalSectionRoutes from './src/routes/legalSections.js';
import documentsRoutes from './src/routes/documents.js';
import invoiceRoutes from './src/routes/invoices.js';
import hearingRoutes from './src/routes/hearings.js';
import dashboardRoutes from './src/routes/dashboard.js';
import path from 'path';

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080';
    const allowedOrigins = corsOrigin.split(',').map(o => o.trim()).filter(o => o.length > 0);
    
    // Log for debugging
    console.log('CORS check - Origin:', origin);
    console.log('CORS check - Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      console.log('CORS: Allowing origin:', origin);
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      console.warn('CORS allowed origins:', allowedOrigins);
      callback(new Error(`Not allowed by CORS. Origin: ${origin} not in allowed list.`));
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
      legalSections: '/api/legal-sections'
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

// Serve uploads (legacy support - files now stored in Cloudinary)
// This route is kept for backward compatibility with old files
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 404 handler for undefined routes
app.use((req, res) => {
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

const PORT = process.env.PORT || 5000;

// Initialize Firebase (required for Firestore)
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
      process.env.FIREBASE_SERVICE_ACCOUNT || 
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)) {
    initializeFirebase();
    console.log('Firebase initialized successfully');
  } else {
    console.error('Firebase configuration required. Please set Firebase environment variables.');
    process.exit(1);
  }
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log('Using Firebase Firestore for database');
  console.log('Using Cloudinary for media storage');
});



