import mongoose from 'mongoose';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Case from '../models/Case.js';
import Document from '../models/Document.js';
import Folder from '../models/Folder.js';
import Invoice from '../models/Invoice.js';
import Hearing from '../models/Hearing.js';
import Alert from '../models/Alert.js';
import TimeEntry from '../models/TimeEntry.js';
import Activity from '../models/Activity.js';
import LegalSection from '../models/LegalSection.js';
import PasswordReset from '../models/PasswordReset.js';

/**
 * MongoDB service layer providing database operations
 * Uses Mongoose models for data persistence
 */

// Model registry - maps collection names to Mongoose models
const MODEL_MAP = {
    users: User,
    clients: Client,
    cases: Case,
    documents: Document,
    folders: Folder,
    invoices: Invoice,
    hearings: Hearing,
    alerts: Alert,
    timeEntries: TimeEntry,
    activities: Activity,
    legalSections: LegalSection,
    passwordResets: PasswordReset,
};

/**
 * Get Mongoose model by collection name
 * @param {string} collection - Collection name
 * @returns {mongoose.Model}
 */
function getModel(collection) {
    const model = MODEL_MAP[collection];
    if (!model) {
        throw new Error(`Unknown collection: ${collection}`);
    }
    return model;
}

/**
 * Create a document in a collection
 * @param {string} collection - Collection name
 * @param {Object} data - Document data
 * @returns {Promise<Object>} Created document with id
 */
export async function createDocument(collection, data) {
    try {
        const Model = getModel(collection);

        // Create document
        const doc = await Model.create(data);

        // Return in API-friendly format (id instead of _id)
        return {
            id: doc._id.toString(),
            ...doc.toObject(),
            _id: undefined, // Remove _id for cleaner API response
        };
    } catch (error) {
        console.error(`Error creating document in ${collection}:`, error);
        throw error;
    }
}

/**
 * Get a document by ID
 * @param {string} collection - Collection name
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Document or null if not found
 */
export async function getDocumentById(collection, id) {
    try {
        const Model = getModel(collection);

        const doc = await Model.findById(id);
        if (!doc) {
            return null;
        }

        // Return in API-friendly format
        return {
            id: doc._id.toString(),
            ...doc.toObject(),
            _id: undefined,
        };
    } catch (error) {
        console.error(`Error getting document from ${collection}:`, error);
        throw error;
    }
}

/**
 * Update a document
 * @param {string} collection - Collection name
 * @param {string} id - Document ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated document
 */
export async function updateDocument(collection, id, data) {
    try {
        const Model = getModel(collection);

        const doc = await Model.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        );

        if (!doc) {
            throw new Error(`Document not found: ${id}`);
        }

        // Return in API-friendly format
        return {
            id: doc._id.toString(),
            ...doc.toObject(),
            _id: undefined,
        };
    } catch (error) {
        console.error(`Error updating document in ${collection}:`, error);
        throw error;
    }
}

/**
 * Delete a document
 * @param {string} collection - Collection name
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteDocument(collection, id) {
    try {
        const Model = getModel(collection);

        await Model.findByIdAndDelete(id);
        return true;
    } catch (error) {
        console.error(`Error deleting document from ${collection}:`, error);
        throw error;
    }
}

/**
 * Query documents with filters
 * @param {string} collection - Collection name
 * @param {Array} filters - Array of {field, operator, value} objects
 * @param {Object} orderBy - {field, direction} for sorting
 * @param {number} limit - Max number of documents
 * @returns {Promise<Array>} Array of documents
 */
export async function queryDocuments(collection, filters = [], orderBy = null, limit = null) {
    try {
        const Model = getModel(collection);
        let query = Model.find();

        // Apply filters
        filters.forEach(filter => {
            const { field, operator, value } = filter;

            switch (operator) {
                case '==':
                    query = query.where(field).equals(value);
                    break;
                case '!=':
                    query = query.where(field).ne(value);
                    break;
                case '>':
                    query = query.where(field).gt(value);
                    break;
                case '>=':
                    query = query.where(field).gte(value);
                    break;
                case '<':
                    query = query.where(field).lt(value);
                    break;
                case '<=':
                    query = query.where(field).lte(value);
                    break;
                case 'in':
                    query = query.where(field).in(value);
                    break;
                case 'array-contains':
                    query = query.where(field).elemMatch({ $eq: value });
                    break;
                default:
                    throw new Error(`Unsupported operator: ${operator}`);
            }
        });

        // Apply ordering
        if (orderBy) {
            const sortOrder = orderBy.direction === 'desc' ? -1 : 1;
            query = query.sort({ [orderBy.field]: sortOrder });
        }

        // Apply limit
        if (limit) {
            query = query.limit(limit);
        }

        const docs = await query.exec();

        // Return in API-friendly format
        return docs.map(doc => ({
            id: doc._id.toString(),
            ...doc.toObject(),
            _id: undefined,
        }));
    } catch (error) {
        console.error(`Error querying documents from ${collection}:`, error);
        throw error;
    }
}

/**
 * Get all documents in a collection
 * @param {string} collection - Collection name
 * @param {Object} orderBy - {field, direction} for sorting
 * @returns {Promise<Array>} Array of documents
 */
export async function getAllDocuments(collection, orderBy = null) {
    return queryDocuments(collection, [], orderBy, null);
}

/**
 * Batch write operations
 * @param {Array} operations - Array of {type, collection, id?, data?} objects
 * @returns {Promise<boolean>} True if successful
 */
export async function batchWrite(operations) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        for (const op of operations) {
            const Model = getModel(op.collection);

            if (op.type === 'create') {
                await Model.create([op.data], { session });
            } else if (op.type === 'update') {
                await Model.findByIdAndUpdate(op.id, { $set: op.data }, { session });
            } else if (op.type === 'delete') {
                await Model.findByIdAndDelete(op.id, { session });
            }
        }

        await session.commitTransaction();
        return true;
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in batch write:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// Collection names that map to Mongoose models
export const COLLECTIONS = {
    USERS: 'users',
    CASES: 'cases',
    CLIENTS: 'clients',
    DOCUMENTS: 'documents',
    FOLDERS: 'folders',
    INVOICES: 'invoices',
    HEARINGS: 'hearings',
    ALERTS: 'alerts',
    TIME_ENTRIES: 'timeEntries',
    ACTIVITIES: 'activities',
    LEGAL_SECTIONS: 'legalSections',
    PASSWORD_RESETS: 'passwordResets',
};

// Export model names (alternative to collection names)
export const MODELS = COLLECTIONS;

export default mongoose;
