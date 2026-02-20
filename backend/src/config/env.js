/**
 * Centralised environment variable validation.
 * Validated once at startup using Zod — fail fast if config is wrong.
 *
 * Usage (must be first import in index.js):
 *   import { env } from './src/config/env.js';
 */

import { z } from 'zod';

// ── Schema ────────────────────────────────────────────────────────────────────
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'staging', 'test', 'production']).default('development'),
    PORT: z.coerce.number().min(1).max(65535).default(5000),

    // Database
    MONGODB_URI: z.string().url('MONGODB_URI must be a valid connection string'),

    // Auth — minimum 32 chars enforced
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

    // Multi-key rotation (optional — JSON array of { kid, secret, active })
    JWT_KEYS: z.string().optional(),

    // CORS
    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    // Redis — required in production
    REDIS_URL: z.string().optional(),

    // Logging
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // Optional external services
    SENTRY_DSN: z.string().url().optional().or(z.literal('')),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    FROM_EMAIL: z.string().email().optional(),

    // Deployment
    SHUTDOWN_TIMEOUT: z.coerce.number().default(2000),
});

// ── Production-specific extra rules ──────────────────────────────────────────
function applyProductionRules(data) {
    const errors = [];

    if (data.NODE_ENV === 'production') {
        if (!data.REDIS_URL) {
            errors.push('REDIS_URL is required in production. Set REDIS_URL=rediss://... or use fallback only in development.');
        }
        if (!data.SENTRY_DSN) {
            // Warn but don't fail — Sentry is highly recommended but optional
            console.warn('[startup] SENTRY_DSN not set — error tracking disabled in production');
        }
        if (!data.CLOUDINARY_CLOUD_NAME) {
            console.warn('[startup] CLOUDINARY credentials not set — file uploads will fail');
        }
        if (data.JWT_SECRET.length < 64) {
            errors.push('JWT_SECRET must be at least 64 characters in production (use openssl rand -base64 64)');
        }
        if (data.JWT_REFRESH_SECRET.length < 64) {
            errors.push('JWT_REFRESH_SECRET must be at least 64 characters in production');
        }
    }

    return errors;
}

// ── Validate ──────────────────────────────────────────────────────────────────
function validateEnv() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const issues = result.error.issues.map(i => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
        console.error(`\n🚨 FATAL: Invalid environment configuration:\n${issues}\n`);
        process.exit(1);
    }

    const productionErrors = applyProductionRules(result.data);
    if (productionErrors.length > 0) {
        const msg = productionErrors.map(e => `  • ${e}`).join('\n');
        console.error(`\n🚨 FATAL: Production environment requirements not met:\n${msg}\n`);
        process.exit(1);
    }

    return result.data;
}

// Validated, typed env — singleton
export const env = validateEnv();
export default env;
