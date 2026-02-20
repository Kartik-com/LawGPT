/**
 * Audit logging helper — non-blocking, fire-and-forget.
 * Uses setImmediate to defer the DB write without affecting response time.
 */

import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/**
 * Write an audit log entry asynchronously (non-blocking).
 *
 * @param {object} req - Express request (for IP, user agent, userId)
 * @param {string} action - Must match AuditLog action enum
 * @param {string} [resourceType] - 'user' | 'document' | 'case' etc.
 * @param {string} [resourceId] - MongoDB ObjectId string
 * @param {object} [metadata] - Extra context (sanitised — no passwords/tokens)
 */
export function auditLog(req, action, resourceType, resourceId, metadata = {}) {
    // Use setImmediate so this never blocks the response
    setImmediate(async () => {
        try {
            await AuditLog.create({
                userId: req.user?.userId || req.user?._id || null,
                action,
                resourceType,
                resourceId: resourceId?.toString(),
                ip: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers?.['user-agent'],
                metadata,
            });
        } catch (err) {
            // Audit log failures are non-fatal — log but never crash the app
            logger.error({ err, action, resourceType, resourceId }, 'Audit log write failed');
        }
    });
}

/**
 * Express middleware factory — automatically logs on response finish.
 * Use for route-level audit logging where you want automatic capture.
 *
 * @param {string} action
 * @param {string} resourceType
 * @param {(req) => string} [getResourceId] - Function extracting resource ID from request
 * @param {(req) => object} [getMetadata]   - Function extracting metadata from request
 */
export function auditMiddleware(action, resourceType, getResourceId, getMetadata) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);

        res.json = (body) => {
            const result = originalJson(body);
            // Only log successful mutations (2xx responses)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const resourceId = getResourceId ? getResourceId(req, body) : req.params?.id;
                const metadata = getMetadata ? getMetadata(req, body) : {};
                auditLog(req, action, resourceType, resourceId, metadata);
            }
            return result;
        };

        next();
    };
}
