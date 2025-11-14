import { getFirestore } from '../config/firebase.js';
import admin from 'firebase-admin';

const db = getFirestore();

/**
 * Generic Firestore service functions
 */

// Create a document
export async function createDocument(collection, data) {
  try {
    const docData = {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Remove undefined values
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) {
        delete docData[key];
      }
    });
    
    const docRef = await db.collection(collection).add(docData);
    
    // Get the created document to return with timestamps
    const doc = await docRef.get();
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Error creating document in ${collection}:`, error);
    console.error('Data:', data);
    throw error;
  }
}

// Get a document by ID
export async function getDocumentById(collection, id) {
  try {
    const doc = await db.collection(collection).doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error(`Error getting document from ${collection}:`, error);
    throw error;
  }
}

// Update a document
export async function updateDocument(collection, id, data) {
  try {
    await db.collection(collection).doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return await getDocumentById(collection, id);
  } catch (error) {
    console.error(`Error updating document in ${collection}:`, error);
    throw error;
  }
}

// Delete a document
export async function deleteDocument(collection, id) {
  try {
    await db.collection(collection).doc(id).delete();
    return true;
  } catch (error) {
    console.error(`Error deleting document from ${collection}:`, error);
    throw error;
  }
}

// Query documents with filters
export async function queryDocuments(collection, filters = [], orderBy = null, limit = null) {
  try {
    let query = db.collection(collection);

    // Apply filters
    filters.forEach(filter => {
      query = query.where(filter.field, filter.operator, filter.value);
    });

    // Apply ordering - Firestore requires composite index if ordering by different field than filter
    let needsInMemorySort = false;
    if (orderBy) {
      query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
    }

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (queryError) {
      // If query fails due to missing index, try without ordering
      if (queryError.code === 9 || queryError.message?.includes('index') || queryError.message?.includes('requires an index')) {
        console.warn(`⚠️  Firestore index missing for ${collection}. Querying without orderBy, will sort in memory.`);
        console.warn(`   To fix: Visit https://console.firebase.google.com/project/lawgpt-7cb25/firestore/indexes`);
        console.warn(`   Create composite index: ${collection} (${filters.map(f => f.field).join(', ')}, ${orderBy?.field})`);
        
        // Retry without ordering
        query = db.collection(collection);
        filters.forEach(filter => {
          query = query.where(filter.field, filter.operator, filter.value);
        });
        if (limit) {
          query = query.limit(limit);
        }
        snapshot = await query.get();
        needsInMemorySort = true;
      } else {
        throw queryError;
      }
    }

    let results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort in memory if needed (either because index was missing, or as fallback)
    if ((orderBy && needsInMemorySort) || (orderBy && results.length > 0)) {
      try {
        const field = orderBy.field;
        const direction = orderBy.direction || 'asc';
        results.sort((a, b) => {
          let aVal = a[field];
          let bVal = b[field];
          
          // Handle Firestore Timestamps
          if (aVal?.toDate) aVal = aVal.toDate();
          if (bVal?.toDate) bVal = bVal.toDate();
          
          // Handle dates
          if (aVal instanceof Date) aVal = aVal.getTime();
          if (bVal instanceof Date) bVal = bVal.getTime();
          
          // Handle null/undefined
          if (aVal == null) aVal = direction === 'desc' ? -Infinity : Infinity;
          if (bVal == null) bVal = direction === 'desc' ? -Infinity : Infinity;
          
          if (direction === 'desc') {
            return (bVal || 0) - (aVal || 0);
          }
          return (aVal || 0) - (bVal || 0);
        });
      } catch (sortError) {
        console.warn('In-memory sort failed:', sortError.message);
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error querying documents from ${collection}:`, error);
    console.error('Query details:', { collection, filters, orderBy, limit });
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // If it's an index error, provide helpful message
    if (error.code === 9 || error.message?.includes('index') || error.message?.includes('requires an index')) {
      console.error('⚠️  Firestore composite index required!');
      console.error('   Visit: https://console.firebase.google.com/project/lawgpt-7cb25/firestore/indexes');
      console.error('   Create index for:', { 
        collection, 
        fields: [...filters.map(f => f.field), orderBy?.field].filter(Boolean)
      });
    }
    
    throw error;
  }
}

// Get all documents in a collection
export async function getAllDocuments(collection, orderBy = null) {
  try {
    let query = db.collection(collection);
    
    if (orderBy) {
      query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting all documents from ${collection}:`, error);
    throw error;
  }
}

// Batch write operations
export async function batchWrite(operations) {
  try {
    const batch = db.batch();
    
    operations.forEach(op => {
      if (op.type === 'create') {
        const docRef = db.collection(op.collection).doc();
        batch.set(docRef, {
          ...op.data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (op.type === 'update') {
        const docRef = db.collection(op.collection).doc(op.id);
        batch.update(docRef, {
          ...op.data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (op.type === 'delete') {
        const docRef = db.collection(op.collection).doc(op.id);
        batch.delete(docRef);
      }
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error in batch write:', error);
    throw error;
  }
}

// Collection names
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
};

export default db;

