/**
 * Distributed tracing middleware — attaches a unique requestId per request.
 * Propagates across pino logger, Sentry, and response headers.
 *
 * Usage: app.use(requestId) — must come BEFORE pinoHttp
 */

import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
    // Respect upstream traceparent / X-Request-Id (from load balancer, Cloudflare, etc.)
    const incoming =
        req.headers['x-request-id'] ||
        req.headers['x-trace-id'] ||
        req.headers['traceparent'];

    const id = incoming || randomUUID();
    req.requestId = id;

    // Set on response so clients can correlate logs
    res.setHeader('X-Request-Id', id);

    next();
}

/**
 * Create a pino child logger bound to a specific request.
 * Usage: const log = requestLogger(req); log.info('Something happened');
 */
export function requestLogger(req) {
    // Assumes req.log is set by pino-http; fall back to imported logger
    const base = req.log || (async () => { const { default: l } = await import('./logger.js'); return l; })();
    return typeof base.child === 'function'
        ? base.child({ requestId: req.requestId })
        : base;
}
