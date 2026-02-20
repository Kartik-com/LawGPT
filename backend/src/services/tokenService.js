import redis from '../utils/redis.js';
import logger from '../utils/logger.js';

/**
 * Service to handle token lifecycle operations in Redis (e.g., blacklisting)
 */
const TOKEN_BLACKLIST_PREFIX = 'bl:';

/**
 * Blacklist a token until its natural expiry
 * @param {string} token - The raw JWT token
 * @param {number} expiryInSeconds - Time until the token expires
 */
export async function blacklistToken(token, expiryInSeconds) {
    if (!token || expiryInSeconds <= 0) return;

    try {
        const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
        // Store in Redis with the same expiry as the token itself
        await redis.set(key, '1', expiryInSeconds);
        logger.info({ tokenPrefix: token.substring(0, 10) }, 'Token blacklisted in Redis');
    } catch (error) {
        logger.error({ error }, 'Failed to blacklist token in Redis');
    }
}

/**
 * Check if a token is blacklisted
 * @param {string} token - The raw JWT token
 * @returns {Promise<boolean>}
 */
export async function isTokenBlacklisted(token) {
    if (!token) return false;

    try {
        const key = `${TOKEN_BLACKLIST_PREFIX}${token}`;
        const exists = await redis.exists(key);
        return exists === 1;
    } catch (error) {
        logger.error({ error }, 'Failed to check token blacklist in Redis');
        return false; // Fallback to allowed if Redis fails (fail-open)
    }
}

export default {
    blacklistToken,
    isTokenBlacklisted
};
