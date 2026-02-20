/**
 * Worker coordinator — starts all BullMQ workers in a separate process.
 *
 * Usage:
 *   node src/workers/index.js
 *
 * - Can run on a separate Dyno / Railway container
 * - API server runs independently
 * - All workers share the same Redis connection
 */

import dotenv from 'dotenv';
dotenv.config();

import logger from '../utils/logger.js';
import { startEmailWorker } from './emailWorker.js';
import { startCleanupWorker } from './cleanupWorker.js';

if (!process.env.REDIS_URL) {
    logger.error('REDIS_URL is required to run workers. Exiting.');
    process.exit(1);
}

logger.info('Starting LawGPT background workers...');

const emailWorker = startEmailWorker();
const cleanupWorker = startCleanupWorker();

const workers = [emailWorker, cleanupWorker].filter(Boolean);
logger.info({ count: workers.length }, 'Workers started');

// Graceful shutdown
const shutdown = async (signal) => {
    logger.info({ signal }, 'Workers shutting down...');
    await Promise.all(workers.map(w => w?.close()));
    logger.info('All workers closed');
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Worker uncaught exception');
    shutdown('uncaughtException');
});
