/**
 * Account lockout middleware — Redis-backed.
 *
 * After MAX_FAILURES failed login attempts within WINDOW_MINUTES,
 * the account is locked for LOCKOUT_MINUTES.
 *
 * Usage:
 *   Import { trackFailedLogin, checkAccountLockout, clearFailedLogins } from './accountLockout.js'
 *   Apply checkAccountLockout BEFORE verifying credentials.
 *   Call trackFailedLogin AFTER a credential failure.
 *   Call clearFailedLogins AFTER a successful login.
 */

import redis from '../utils/redis.js';
import logger from '../utils/logger.js';
import { auditLog } from './audit.js';

const MAX_FAILURES = parseInt(process.env.LOCKOUT_MAX_FAILURES || '5', 10);
const WINDOW_SECONDS = parseInt(process.env.LOCKOUT_WINDOW_SECONDS || '900', 10); // 15 min
const LOCKOUT_SECONDS = parseInt(process.env.LOCKOUT_DURATION_SECONDS || '1800', 10); // 30 min

function lockKey(identifier) { return `lockout:lock:${identifier}`; }
function failKey(identifier) { return `lockout:fail:${identifier}`; }

/**
 * Middleware — checks if the account is currently locked.
 * @param {(req) => string} getIdentifier — function to extract lockout key (email or userId)
 */
export function checkAccountLockout(getIdentifier = (req) => req.body?.email?.toLowerCase()) {
    return async (req, res, next) => {
        const identifier = getIdentifier(req);
        if (!identifier) return next();

        const lockUntil = await redis.get(lockKey(identifier));
        if (lockUntil) {
            const remainingMs = parseInt(lockUntil, 10) - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);

            logger.warn({ identifier, remainingMin }, 'Account lockout: access blocked');
            auditLog(req, 'login', 'user', null, { reason: 'account_locked', identifier });

            return res.status(423).json({
                error: 'Account Locked',
                message: `Too many failed login attempts. Account locked for ${remainingMin} more minute(s).`,
                retryAfter: Math.ceil(remainingMs / 1000),
            });
        }

        next();
    };
}

/**
 * Record a failed login attempt. Locks account if threshold reached.
 */
export async function trackFailedLogin(req, identifier) {
    if (!identifier) return;

    const fKey = failKey(identifier);
    const count = await redis.incr(fKey);

    if (count === 1) {
        // Set expiry on first failure so key auto-clears
        await redis.expire(fKey, WINDOW_SECONDS);
    }

    logger.info({ identifier, count, maxFailures: MAX_FAILURES }, 'Failed login tracked');

    if (count >= MAX_FAILURES) {
        // Lock the account
        const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000;
        await redis.set(lockKey(identifier), String(lockUntil), LOCKOUT_SECONDS);
        await redis.del(fKey); // Reset failure counter

        logger.warn({ identifier, lockoutSeconds: LOCKOUT_SECONDS }, '🔒 Account locked');
        auditLog(req, 'login', 'user', null, {
            reason: 'account_locked',
            identifier,
            failureCount: count,
        });
    }

    return count;
}

/**
 * Clear failed login counter on successful authentication.
 */
export async function clearFailedLogins(identifier) {
    if (!identifier) return;
    await redis.del(failKey(identifier));
}
