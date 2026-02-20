/**
 * CSRF Protection — Double-Submit Cookie Strategy
 *
 * Flow:
 *   1. GET /api/v1/auth/csrf-token sets csrf-token cookie (non-httpOnly, SameSite=strict)
 *   2. Frontend reads cookie and sends it as X-CSRF-Token header on every mutating request
 *   3. This middleware verifies header matches cookie for POST/PUT/PATCH/DELETE
 *
 * Exempt routes (public/pre-auth):
 *   login, register, refresh, forgot-password, reset-password, reactivate, verify-email
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Routes that are explicitly exempt from CSRF (no access token exists yet)
// Uses originalUrl patterns to match both /api/v1/auth/* and /api/auth/* (compat)
const CSRF_EXEMPT_PATTERNS = [
    /\/auth\/login$/,
    /\/auth\/register$/,
    /\/auth\/refresh$/,
    /\/auth\/logout$/,
    /\/auth\/forgot-password$/,
    /\/auth\/reset-password$/,
    /\/auth\/reactivate$/,
    /\/auth\/verify-email$/,
    /\/auth\/resend-verification$/,
    /\/auth\/csrf-token$/, // Endpoint itself
    /\/auth\/change-password$/, // Requires auth but user sends old+new password
];

function isExempt(req) {
    const url = req.originalUrl?.split('?')[0] || req.path;
    return CSRF_EXEMPT_PATTERNS.some(pattern => pattern.test(url));
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ── Middleware: issue CSRF token ───────────────────────────────────────────────
export function setCsrfToken(req, res, next) {
    let token = req.cookies?.['csrf-token'];
    if (!token) {
        token = generateToken();
    }

    // Non-httpOnly so JS can read it; SameSite=strict to prevent CSRF from other origins
    res.cookie('csrf-token', token, {
        httpOnly: false,   // Must be JS-readable
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/',
    });

    res.json({ csrfToken: token });
}

// ── Middleware: validate CSRF token ───────────────────────────────────────────
export function csrfProtection(req, res, next) {
    // Only enforce on mutating methods
    if (!MUTATING_METHODS.has(req.method)) return next();
    // Exempt public auth routes (login, register, refresh, reactivate, etc.)
    if (isExempt(req)) return next();


    const cookieToken = req.cookies?.['csrf-token'];
    const headerToken = req.headers?.['x-csrf-token'];

    if (!cookieToken || !headerToken) {
        logger.warn({ path: req.path, method: req.method }, 'CSRF: missing token');
        return res.status(403).json({
            error: 'CSRF validation failed',
            message: 'Missing CSRF token. Ensure X-CSRF-Token header is set.',
        });
    }

    // Constant-time comparison to prevent timing attacks
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (
        cookieBuf.length !== headerBuf.length ||
        !crypto.timingSafeEqual(cookieBuf, headerBuf)
    ) {
        logger.warn({ path: req.path, method: req.method, ip: req.ip }, 'CSRF: token mismatch');
        return res.status(403).json({
            error: 'CSRF validation failed',
            message: 'Invalid CSRF token.',
        });
    }

    next();
}
