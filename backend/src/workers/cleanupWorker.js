/**
 * Cleanup worker — removes stale/expired data.
 * Runs on a scheduled basis (every 6 hours).
 */

import { Worker, Queue, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger.js';

const QUEUE_NAME = 'cleanup';

function getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;
    return new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

async function processCleanupJob(job) {
    const { type } = job.data;
    logger.info({ jobId: job.id, type }, 'Cleanup worker: processing');

    const { default: AuditLog } = await import('../models/AuditLog.js');

    if (type === 'expired_audit_logs') {
        // TTL index handles this automatically, but this is a manual safety net
        const result = await AuditLog.deleteMany({ expiresAt: { $lt: new Date() } });
        logger.info({ deleted: result.deletedCount }, 'Cleanup: expired audit logs purged');
        return { deleted: result.deletedCount };
    }

    logger.warn({ type }, 'Cleanup worker: unknown job type');
    return {};
}

export function startCleanupWorker() {
    const connection = getRedisConnection();
    if (!connection) return null;

    const worker = new Worker(QUEUE_NAME, processCleanupJob, {
        connection,
        concurrency: 1,
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, err }, 'Cleanup job failed');
    });

    logger.info('Cleanup worker started');
    return worker;
}

export function getCleanupQueue() {
    const connection = getRedisConnection();
    if (!connection) return null;
    return new Queue(QUEUE_NAME, { connection });
}
