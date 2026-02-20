/**
 * Email worker — processes BullMQ jobs from the 'email' queue.
 *
 * To start workers standalone:
 *   node src/workers/index.js
 *
 * Jobs supported:
 *   - sendPasswordReset    { to, resetLink }
 *   - sendVerification     { to, verifyLink }
 *   - sendWelcome          { to, name }
 *   - sendInvoice          { to, invoiceId, pdfUrl }
 */

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../utils/logger.js';

const QUEUE_NAME = 'email';
const MAX_RETRIES = 3;

// ── BullMQ requires a direct ioredis connection (not our wrapper) ─────────────
function getRedisConnection() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('Email worker: REDIS_URL not set — email queue disabled');
        return null;
    }

    return new IORedis(redisUrl, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
    });
}

// ── Queue (for enqueueing jobs from route handlers) ──────────────────────────
let emailQueue = null;

export function getEmailQueue() {
    if (emailQueue) return emailQueue;
    const connection = getRedisConnection();
    if (!connection) return null;

    emailQueue = new Queue(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            attempts: MAX_RETRIES,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
        },
    });

    return emailQueue;
}

// ── Job processor ─────────────────────────────────────────────────────────────
async function processEmailJob(job) {
    const { type, payload } = job.data;
    logger.info({ jobId: job.id, type }, 'Email worker: processing job');

    // Dynamically import SendGrid to avoid loading at startup if not configured
    const sgMailModule = await import('@sendgrid/mail').catch(() => null);
    const sgMail = sgMailModule?.default;

    if (!sgMail || !process.env.SENDGRID_API_KEY) {
        logger.warn({ jobId: job.id, type }, 'Email worker: SendGrid not configured — job skipped');
        return { skipped: true };
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || 'noreply@lawgpt.app';

    const templates = {
        sendPasswordReset: {
            to: payload.to,
            from: fromEmail,
            subject: 'Reset Your LawGPT Password',
            html: `<p>Click <a href="${payload.resetLink}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        },
        sendVerification: {
            to: payload.to,
            from: fromEmail,
            subject: 'Verify Your LawGPT Email',
            html: `<p>Click <a href="${payload.verifyLink}">here</a> to verify your email address.</p>`,
        },
        sendWelcome: {
            to: payload.to,
            from: fromEmail,
            subject: 'Welcome to LawGPT!',
            html: `<p>Hi ${payload.name}, welcome to LawGPT. Your account is ready.</p>`,
        },
        sendInvoice: {
            to: payload.to,
            from: fromEmail,
            subject: `Invoice #${payload.invoiceId} from LawGPT`,
            html: `<p>Your invoice is ready. <a href="${payload.pdfUrl}">View Invoice</a></p>`,
        },
    };

    const emailConfig = templates[type];
    if (!emailConfig) {
        throw new Error(`Unknown email job type: ${type}`);
    }

    await sgMail.send(emailConfig);
    logger.info({ jobId: job.id, type, to: payload.to }, 'Email worker: email sent');
    return { sent: true };
}

// ── Worker ────────────────────────────────────────────────────────────────────
export function startEmailWorker() {
    const connection = getRedisConnection();
    if (!connection) return null;

    const worker = new Worker(QUEUE_NAME, processEmailJob, {
        connection,
        concurrency: 5,
        limiter: { max: 10, duration: 1000 }, // Max 10 emails/sec
    });

    worker.on('completed', (job) => {
        logger.info({ jobId: job.id, type: job.data.type }, 'Email job completed');
    });

    worker.on('failed', (job, err) => {
        logger.error({ jobId: job?.id, type: job?.data?.type, err }, 'Email job failed');
    });

    worker.on('error', (err) => {
        logger.error({ err }, 'Email worker error');
    });

    logger.info('Email worker started');
    return worker;
}
