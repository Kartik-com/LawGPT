/**
 * JWT Key Store — multi-key rotation support.
 *
 * Supports two modes:
 *   1. Single key (legacy): JWT_SECRET env var → backward compatible
 *   2. Multi-key rotation: JWT_KEYS env var (JSON array)
 *
 * JWT_KEYS example:
 *   [
 *     { "kid": "key-2025-01", "secret": "...64char...", "active": false },
 *     { "kid": "key-2025-07", "secret": "...64char...", "active": true }
 *   ]
 *
 * Rules:
 *   - Only ONE key may have "active": true (used for signing new tokens)
 *   - Old keys with "active": false still verify tokens until removed
 *   - Remove old keys only AFTER all tokens signed with them have expired
 */

import jwt from 'jsonwebtoken';
import logger from './logger.js';

// ── Build key registry ────────────────────────────────────────────────────────
function buildKeyRegistry() {
    const registry = new Map(); // kid → { kid, secret, active }
    let activeKey = null;

    if (process.env.JWT_KEYS) {
        try {
            const keys = JSON.parse(process.env.JWT_KEYS);
            if (!Array.isArray(keys) || keys.length === 0) {
                throw new Error('JWT_KEYS must be a non-empty JSON array');
            }

            for (const key of keys) {
                if (!key.kid || !key.secret) {
                    throw new Error(`JWT_KEYS: each key must have "kid" and "secret". Got: ${JSON.stringify(key)}`);
                }
                registry.set(key.kid, key);
                if (key.active) {
                    if (activeKey) throw new Error('JWT_KEYS: only one key may be "active": true');
                    activeKey = key;
                }
            }

            if (!activeKey) throw new Error('JWT_KEYS: exactly one key must have "active": true');
            logger.info({ keyCount: registry.size, activeKid: activeKey.kid }, 'JWT keyStore: multi-key mode');
        } catch (err) {
            logger.error({ err }, 'JWT_KEYS parse failed — falling back to JWT_SECRET');
            registry.clear();
            activeKey = null;
        }
    }

    // Fallback to single-key mode
    if (registry.size === 0) {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is required');
        const singleKey = { kid: 'default', secret, active: true };
        registry.set('default', singleKey);
        activeKey = singleKey;
        logger.info('JWT keyStore: single-key mode (set JWT_KEYS for rotation support)');
    }

    return { registry, activeKey };
}

const { registry, activeKey } = buildKeyRegistry();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Sign a JWT using the current active signing key.
 * Embeds "kid" in the token header for rotation support.
 */
export function signToken(payload, options = {}) {
    return jwt.sign(payload, activeKey.secret, {
        ...options,
        header: { alg: 'HS256', kid: activeKey.kid },
    });
}

/**
 * Verify a JWT. Tries matching kid first, then falls back to trying all keys.
 * Returns the decoded payload or throws on failure.
 */
export function verifyToken(token) {
    // Decode header without verification to extract kid
    let kid = 'default';
    try {
        const decoded = jwt.decode(token, { complete: true });
        if (decoded?.header?.kid) kid = decoded.header.kid;
    } catch {
        // Malformed token — let jwt.verify throw the proper error below
    }

    // Try matching key first
    if (registry.has(kid)) {
        return jwt.verify(token, registry.get(kid).secret);
    }

    // Fallback: try all keys (handles tokens without kid header)
    const errors = [];
    for (const [, key] of registry) {
        try {
            return jwt.verify(token, key.secret);
        } catch (err) {
            errors.push(err.message);
        }
    }

    throw new Error(`JWT verification failed with all keys: ${errors.join('; ')}`);
}

/**
 * Sign a refresh token (uses JWT_REFRESH_SECRET — not rotated via keyStore).
 */
export function signRefreshToken(payload, options = {}) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, options);
}

export function verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/** Returns the active key ID — useful for logging/debugging */
export function getActiveKid() {
    return activeKey.kid;
}
