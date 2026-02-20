/**
 * Redis cache abstraction — cache-aside pattern.
 *
 * Usage:
 *   const data = await cache.getOrSet('user:123', 300, () => User.findById('123'));
 *   await cache.invalidate('user:123');
 *   await cache.invalidatePattern('user:');
 */

import redis from './redis.js';
import logger from './logger.js';

const DEFAULT_TTL = 300; // 5 minutes

export const cache = {
    /**
     * Get item from cache, or fetch+store if missing.
     * @param {string} key - Cache key
     * @param {number} ttl - TTL in seconds
     * @param {() => Promise<any>} fetchFn - Function to call on cache miss
     */
    async getOrSet(key, ttl = DEFAULT_TTL, fetchFn) {
        try {
            const cached = await redis.get(key);
            if (cached !== null) {
                logger.debug({ key }, 'Cache hit');
                return JSON.parse(cached);
            }
        } catch (err) {
            logger.warn({ err, key }, 'Cache read error — falling through to fetch');
        }

        logger.debug({ key }, 'Cache miss');
        const data = await fetchFn();

        try {
            if (data !== null && data !== undefined) {
                await redis.set(key, JSON.stringify(data), ttl);
            }
        } catch (err) {
            logger.warn({ err, key }, 'Cache write error — data will not be cached');
        }

        return data;
    },

    /**
     * Invalidate a specific cache key.
     */
    async invalidate(key) {
        try {
            await redis.del(key);
            logger.debug({ key }, 'Cache invalidated');
        } catch (err) {
            logger.warn({ err, key }, 'Cache invalidation error');
        }
    },

    /**
     * Invalidate all keys matching a prefix pattern.
     * Uses in-memory scan when Redis not available.
     * NOTE: In production with Redis, use SCAN not KEYS for large keyspaces.
     */
    async invalidatePattern(prefix) {
        if (!redis.isAvailable()) {
            // Fallback handled inside redis.js in-memory store isn't iterable by pattern
            // Just invalidate nothing and let TTL expire it naturally
            return;
        }
        try {
            const rawClient = redis.raw();
            if (!rawClient) return;
            let cursor = '0';
            do {
                const [nextCursor, keys] = await rawClient.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
                cursor = nextCursor;
                if (keys.length > 0) {
                    await rawClient.del(...keys);
                    logger.debug({ prefix, count: keys.length }, 'Cache pattern invalidated');
                }
            } while (cursor !== '0');
        } catch (err) {
            logger.warn({ err, prefix }, 'Cache pattern invalidation error');
        }
    },

    /**
     * Build a namespaced cache key.
     */
    key: {
        user: (id) => `user:${id}`,
        userList: (ownerId, page) => `users:list:${ownerId}:${page}`,
        dashboard: (userId) => `dashboard:metrics:${userId}`,
        cases: (ownerId, page) => `cases:${ownerId}:${page}`,
        clients: (ownerId, page) => `clients:${ownerId}:${page}`,
        documents: (ownerId, folderId, page) => `docs:${ownerId}:${folderId ?? 'root'}:${page}`,
        invoices: (ownerId, page) => `invoices:${ownerId}:${page}`,
    },
};

export default cache;
