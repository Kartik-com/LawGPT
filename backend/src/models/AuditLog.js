import mongoose from 'mongoose';
import crypto from 'crypto';

const GENESIS_HASH = '0'.repeat(64);

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        action: {
            type: String,
            required: true,
            enum: [
                // Auth
                'login', 'logout', 'register', 'reactivate',
                'password_change', 'password_reset', 'password_forgot',
                'email_verify', '2fa_enable', '2fa_disable', '2fa_verify',
                // Documents
                'file_upload', 'file_delete', 'folder_create', 'folder_delete',
                // Cases
                'case_create', 'case_update', 'case_delete',
                // Clients
                'client_create', 'client_update', 'client_delete',
                // Billing
                'invoice_create', 'invoice_update', 'invoice_delete',
                // Admin
                'role_change', 'account_delete', 'settings_update',
                // System
                'rate_limit_triggered', 'csrf_violation', 'account_lockout',
            ],
            index: true,
        },
        resourceType: {
            type: String,
            enum: ['user', 'document', 'folder', 'case', 'client', 'invoice', 'hearing', 'system'],
        },
        resourceId: { type: String },
        ip: { type: String },
        userAgent: { type: String },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        // ── Hash Chain Integrity ────────────────────────────────────────────────
        prevHash: {
            type: String,
            default: GENESIS_HASH,
        },
        hash: {
            type: String,
            index: true,
        },
        // Auto-purge after 90 days
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    },
    {
        timestamps: true,
        writeConcern: { w: 1, j: false },
    }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// ── Statics ──────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of entry data + prevHash (blockchain-style).
 */
auditLogSchema.statics.computeHash = function (entry, prevHash) {
    const payload = JSON.stringify({
        userId: entry.userId?.toString() ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        ip: entry.ip ?? null,
        createdAt: entry.createdAt?.toISOString() ?? null,
        metadata: entry.metadata ?? {},
        prevHash,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Create a new audit log entry chained to the previous entry.
 * Fetches last hash, computes new hash, saves.
 */
auditLogSchema.statics.createChained = async function (data) {
    const Model = this;
    const last = await Model.findOne({}, { hash: 1 }).sort({ createdAt: -1 }).lean();
    const prevHash = last?.hash || GENESIS_HASH;

    // We need createdAt for the hash — set it now so it's deterministic
    const createdAt = new Date();
    const entryData = { ...data, prevHash, createdAt };
    const hash = Model.computeHash(entryData, prevHash);

    return Model.create({ ...entryData, hash });
};

/**
 * Walk the entire audit chain and verify no tampering.
 * Returns { valid, checked, firstTamperedId }
 */
auditLogSchema.statics.verifyChain = async function () {
    const Model = this;
    const entries = await Model.find({}).sort({ createdAt: 1 }).lean();

    if (entries.length === 0) {
        return { valid: true, checked: 0, firstTamperedId: null };
    }

    let prevHash = GENESIS_HASH;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        // Skip legacy entries that predate hash chain (no hash field)
        if (!entry.hash) {
            prevHash = entry.prevHash || prevHash;
            continue;
        }

        const expected = Model.computeHash(entry, entry.prevHash || prevHash);
        if (entry.hash !== expected) {
            return {
                valid: false,
                checked: i,
                firstTamperedId: entry._id,
                message: `Hash mismatch at entry ${entry._id} (entry ${i + 1} of ${entries.length})`,
            };
        }
        prevHash = entry.hash;
    }

    return { valid: true, checked: entries.length, firstTamperedId: null };
};

export default mongoose.model('AuditLog', auditLogSchema);
