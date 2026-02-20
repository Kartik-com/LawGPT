/**
 * Redis client abstraction with graceful in-memory fallback.
 *
 * If REDIS_URL is not set, all operations silently no-op so the
 * application continues to work in development without Redis.
 */

import Redis from 'ioredis';
import logger from './logger.js';

let redisClient = null;
let isConnected = false;

// ── In-memory no-op fallback store ───────────────────────────────────────────
const memStore = new Map(); // key → { value, expiresAt? }

const noop = {
    get: async (key) => {
        const entry = memStore.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            memStore.delete(key);
            return null;
        }
        return entry.value;
    },
    set: async (key, value, expiresInSeconds) => {
        memStore.set(key, {
            value,
            expiresAt: expiresInSeconds ? Date.now() + expiresInSeconds * 1000 : null,
        });
        return 'OK';
    },
    del: async (...keys) => {
        keys.forEach(k => memStore.delete(k));
        return keys.length;
    },
    exists: async (key) => (memStore.has(key) ? 1 : 0),
    expire: async (key, seconds) => {
        const entry = memStore.get(key);
        if (entry) { entry.expiresAt = Date.now() + seconds * 1000; return 1; }
        return 0;
    },
    lpush: async (key, ...values) => {
        const entry = memStore.get(key) || { value: [] };
        entry.value.unshift(...values);
        memStore.set(key, entry);
        return entry.value.length;
    },
    lrange: async (key, start, stop) => {
        const entry = memStore.get(key);
        if (!entry) return [];
        const arr = entry.value;
        return arr.slice(start, stop === -1 ? undefined : stop + 1);
    },
    ping: async () => 'PONG (in-memory fallback)',
    setex: async (key, seconds, value) => noop.set(key, value, seconds),
    incr: async (key) => {
        const current = parseInt((await noop.get(key)) || '0', 10);
        const next = current + 1;
        const entry = memStore.get(key);
        memStore.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
        return next;
    },
};

// ── Connect to Redis ──────────────────────────────────────────────────────────
function createRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('REDIS_URL not set — using in-memory fallback (not suitable for production)');
        return null;
    }

    const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
            if (times > 5) {
                logger.error('Redis: max connection retries reached, falling back to in-memory');
                return null; // stop retrying
            }
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    });

    client.on('connect', () => {
        isConnected = true;
        logger.info('Redis connected');
    });

    client.on('error', (err) => {
        isConnected = false;
        logger.error({ err }, 'Redis connection error');
    });

    client.on('close', () => {
        isConnected = false;
    });

    return client;
}

export async function connectRedis() {
    redisClient = createRedisClient();
    if (!redisClient) return;

    try {
        await redisClient.connect();
    } catch (err) {
        logger.error({ err }, 'Redis initial connection failed — using in-memory fallback');
        redisClient = null;
    }
}

// ── Public API — always returns noop if Redis unavailable ─────────────────────
export const redis = {
    get: async (key) => {
        if (!redisClient || !isConnected) return noop.get(key);
        try { return await redisClient.get(key); }
        catch { return noop.get(key); }
    },
    set: async (key, value, expiresInSeconds) => {
        if (!redisClient || !isConnected) return noop.set(key, value, expiresInSeconds);
        try {
            if (expiresInSeconds) return await redisClient.setex(key, expiresInSeconds, value);
            return await redisClient.set(key, value);
        } catch { return noop.set(key, value, expiresInSeconds); }
    },
    del: async (...keys) => {
        if (!redisClient || !isConnected) return noop.del(...keys);
        try { return await redisClient.del(...keys); }
        catch { return noop.del(...keys); }
    },
    exists: async (key) => {
        if (!redisClient || !isConnected) return noop.exists(key);
        try { return await redisClient.exists(key); }
        catch { return noop.exists(key); }
    },
    expire: async (key, seconds) => {
        if (!redisClient || !isConnected) return noop.expire(key, seconds);
        try { return await redisClient.expire(key, seconds); }
        catch { return noop.expire(key, seconds); }
    },
    lpush: async (key, ...values) => {
        if (!redisClient || !isConnected) return noop.lpush(key, ...values);
        try { return await redisClient.lpush(key, ...values); }
        catch { return noop.lpush(key, ...values); }
    },
    lrange: async (key, start, stop) => {
        if (!redisClient || !isConnected) return noop.lrange(key, start, stop);
        try { return await redisClient.lrange(key, start, stop); }
        catch { return noop.lrange(key, start, stop); }
    },
    incr: async (key) => {
        if (!redisClient || !isConnected) return noop.incr(key);
        try { return await redisClient.incr(key); }
        catch { return noop.incr(key); }
    },
    ping: async () => {
        if (!redisClient || !isConnected) return noop.ping();
        try { return await redisClient.ping(); }
        catch { return 'ERROR'; }
    },
    isAvailable: () => !!(redisClient && isConnected),
    /** Raw ioredis client — use only if you need multi/pipeline */
    raw: () => redisClient,
};

export default redis;
