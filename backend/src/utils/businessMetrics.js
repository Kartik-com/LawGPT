/**
 * Business Metrics — Prometheus counters + gauges for product-level KPIs.
 * These metrics are exposed via /api/v1/metrics alongside default Node.js metrics.
 */

import { Counter, Gauge, register } from 'prom-client';

export const businessMetrics = {
    // Auth
    loginSuccess: new Counter({
        name: 'auth_login_success_total',
        help: 'Total successful logins',
        labelNames: ['method'],  // 'password' | '2fa'
        registers: [register],
    }),
    loginFailure: new Counter({
        name: 'auth_login_failure_total',
        help: 'Total failed login attempts',
        labelNames: ['reason'],  // 'invalid_password' | 'account_locked' | 'not_found'
        registers: [register],
    }),
    accountLockout: new Counter({
        name: 'auth_account_lockout_total',
        help: 'Total account lockout events',
        registers: [register],
    }),
    registrations: new Counter({
        name: 'auth_registrations_total',
        help: 'Total new user registrations',
        registers: [register],
    }),
    tokenRefresh: new Counter({
        name: 'auth_token_refresh_total',
        help: 'Total token refresh operations',
        registers: [register],
    }),

    // Documents
    fileUploads: new Counter({
        name: 'document_uploads_total',
        help: 'Total file uploads',
        labelNames: ['file_type'],  // 'pdf' | 'image' | 'office' | 'other'
        registers: [register],
    }),
    fileDeletes: new Counter({
        name: 'document_deletes_total',
        help: 'Total file deletions',
        registers: [register],
    }),

    // Cases
    caseCreated: new Counter({
        name: 'case_created_total',
        help: 'Total cases created',
        registers: [register],
    }),

    // Billing
    invoiceCreated: new Counter({
        name: 'billing_invoice_created_total',
        help: 'Total invoices created',
        registers: [register],
    }),

    // Sessions (current active sessions — approximate via Redis TTL)
    activeSessions: new Gauge({
        name: 'auth_active_sessions',
        help: 'Approximate number of active user sessions (refresh tokens in Redis)',
        registers: [register],
        collect() {
            // This gauge is set externally when session count changes
            // Default 0 — updated by auth routes
        },
    }),
};

export default businessMetrics;
