/**
 * MongoDB compound index definitions.
 * Called once on server startup — createIndexes is idempotent.
 */

import logger from '../utils/logger.js';

export async function ensureIndexes() {
    // Dynamically import models to avoid circular deps at startup
    const models = await import('../models/index.js').catch(() => null);
    if (!models) { logger.warn('Could not load models for index creation'); return; }

    const indexDefs = [
        {
            name: 'Case',
            model: models.Case,
            indexes: [
                { fields: { ownerId: 1, createdAt: -1 }, options: { name: 'case_owner_created' } },
                { fields: { ownerId: 1, status: 1 }, options: { name: 'case_owner_status' } },
                { fields: { clientId: 1, ownerId: 1 }, options: { name: 'case_client_owner' } },
                { fields: { createdAt: -1 }, options: { name: 'case_created_desc' } },
            ],
        },
        {
            name: 'Client',
            model: models.Client,
            indexes: [
                { fields: { ownerId: 1, createdAt: -1 }, options: { name: 'client_owner_created' } },
                { fields: { ownerId: 1, status: 1 }, options: { name: 'client_owner_status' } },
            ],
        },
        {
            name: 'Document',
            model: models.Document,
            indexes: [
                { fields: { ownerId: 1, folderId: 1 }, options: { name: 'doc_owner_folder' } },
                { fields: { ownerId: 1, createdAt: -1 }, options: { name: 'doc_owner_created' } },
                { fields: { folderId: 1 }, options: { name: 'doc_folder' } },
                { fields: { fileType: 1, ownerId: 1 }, options: { name: 'doc_type_owner' } },
            ],
        },
        {
            name: 'Folder',
            model: models.Folder,
            indexes: [
                { fields: { ownerId: 1 }, options: { name: 'folder_owner' } },
                { fields: { ownerId: 1, parentId: 1 }, options: { name: 'folder_owner_parent' } },
            ],
        },
        {
            name: 'Invoice',
            model: models.Invoice,
            indexes: [
                { fields: { ownerId: 1, status: 1 }, options: { name: 'invoice_owner_status' } },
                { fields: { ownerId: 1, createdAt: -1 }, options: { name: 'invoice_owner_created' } },
                { fields: { clientId: 1, ownerId: 1 }, options: { name: 'invoice_client_owner' } },
            ],
        },
        {
            name: 'Hearing',
            model: models.Hearing,
            indexes: [
                { fields: { ownerId: 1, date: 1 }, options: { name: 'hearing_owner_date' } },
                { fields: { caseId: 1 }, options: { name: 'hearing_case' } },
            ],
        },
        {
            name: 'AuditLog',
            model: models.AuditLog,
            indexes: [
                { fields: { userId: 1, createdAt: -1 }, options: { name: 'audit_user_created' } },
                { fields: { action: 1, createdAt: -1 }, options: { name: 'audit_action_created' } },
            ],
        },
    ];

    let created = 0;
    for (const { name, model, indexes } of indexDefs) {
        if (!model) { logger.warn(`Index: model ${name} not found — skipping`); continue; }
        for (const { fields, options } of indexes) {
            try {
                await model.collection.createIndex(fields, { background: true, ...options });
                created++;
            } catch (err) {
                // Code 85 = index already exists with same name, 86 = different options — both fine
                if (err.code !== 85 && err.code !== 86) {
                    logger.warn({ err, model: name, fields }, 'Index creation warning');
                }
            }
        }
    }

    logger.info({ count: created }, 'MongoDB indexes verified');
}
