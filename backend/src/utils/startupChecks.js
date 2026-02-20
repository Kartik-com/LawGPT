/**
 * Startup security checks — run after env validation, before server listens.
 * These checks warn or hard-fail on security misconfigurations.
 */

import logger from './logger.js';

const isProduction = process.env.NODE_ENV === 'production';

export function runStartupChecks() {
    const errors = [];
    const warnings = [];

    // ── 1. Redis TLS enforcement ─────────────────────────────────────────────────
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        if (isProduction && !redisUrl.startsWith('rediss://')) {
            errors.push(
                'REDIS_URL must use TLS in production (rediss://). ' +
                'Unencrypted Redis connection is not allowed. ' +
                'Update your Redis URL to use "rediss://" scheme.'
            );
        } else if (!isProduction && redisUrl.startsWith('redis://')) {
            warnings.push('REDIS_URL: non-TLS Redis in development (acceptable for local dev)');
        }
    }

    // ── 2. MongoDB TLS enforcement ───────────────────────────────────────────────
    const mongoUri = process.env.MONGODB_URI || '';
    if (isProduction) {
        if (mongoUri.startsWith('mongodb://') && !mongoUri.includes('localhost') && !mongoUri.includes('127.0.0.1')) {
            errors.push(
                'MONGODB_URI must use TLS in production for remote hosts. ' +
                'Use mongodb+srv:// (Atlas) or add ?tls=true to your connection string.'
            );
        }
    }

    // ── 3. MongoDB Atlas free tier (M0) warning ──────────────────────────────────
    // M0 clusters have low storage + connection limits — not suitable for production
    if (isProduction && mongoUri.includes('mongodb.net')) {
        // Not reliable to detect M0 from URI alone — warn to manually verify
        warnings.push(
            'MongoDB Atlas detected. Ensure cluster tier is M10+ for production workloads. ' +
            'M0 free tier has connection limits (500 max) and no guaranteed uptime SLA.'
        );
    }

    // ── 4. Cookie security ───────────────────────────────────────────────────────
    if (isProduction && process.env.CORS_ORIGIN?.includes('http://')) {
        warnings.push(
            'CORS_ORIGIN contains an http:// origin in production. ' +
            'HTTPS is required for secure cookies. Update to https://.'
        );
    }

    // ── 5. Weak secrets detection ────────────────────────────────────────────────
    const weakPatterns = ['secret', 'password', 'changeme', 'test123', 'dev123', '12345'];
    for (const varName of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
        const val = (process.env[varName] || '').toLowerCase();
        if (weakPatterns.some(p => val.includes(p))) {
            if (isProduction) {
                errors.push(`${varName} contains a weak/predictable value. Generate a proper secret: openssl rand -base64 64`);
            } else {
                warnings.push(`${varName} looks weak (fine for dev, NOT for production)`);
            }
        }
    }

    // ── 6. CORS wildcard check ───────────────────────────────────────────────────
    if (isProduction && (process.env.CORS_ORIGIN || '').includes('*')) {
        errors.push('CORS_ORIGIN must not contain wildcard (*) in production. Specify exact allowed origins.');
    }

    // ── Output ───────────────────────────────────────────────────────────────────
    for (const warning of warnings) {
        logger.warn({ check: 'startup' }, `⚠️  ${warning}`);
    }

    if (errors.length > 0) {
        const msg = errors.map(e => `  ✗ ${e}`).join('\n');
        logger.error(`\n🚨 FATAL: Startup security checks failed:\n${msg}\n`);
        process.exit(1);
    }

    logger.info({ checks: warnings.length + errors.length }, '✅ Startup security checks passed');
}
