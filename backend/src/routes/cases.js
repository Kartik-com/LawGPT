import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { logActivity } from '../middleware/activityLogger.js';
import { 
  createDocument, 
  getDocumentById, 
  updateDocument, 
  deleteDocument,
  queryDocuments,
  COLLECTIONS 
} from '../services/firestore.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const cases = await queryDocuments(
      COLLECTIONS.CASES,
      [{ field: 'owner', operator: '==', value: req.user.userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    res.json(cases);
  } catch (error) {
    console.error('Get cases error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to fetch cases',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        code: error.code
      })
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, owner: req.user.userId };
    const item = await createDocument(COLLECTIONS.CASES, data);
    
    // Log activity
    await logActivity(
      req.user.userId,
      'case_created',
      `New case ${item.caseNumber} created for ${item.clientName}`,
      'case',
      item.id,
      {
        caseNumber: item.caseNumber,
        clientName: item.clientName,
        priority: item.priority,
        status: item.status
      }
    );
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getDocumentById(COLLECTIONS.CASES, req.params.id);
    if (!item || item.owner !== req.user.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getDocumentById(COLLECTIONS.CASES, req.params.id);
    if (!existing || existing.owner !== req.user.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const item = await updateDocument(COLLECTIONS.CASES, req.params.id, req.body);
    
    // Log activity
    await logActivity(
      req.user.userId,
      'case_updated',
      `Case ${item.caseNumber} updated`,
      'case',
      item.id,
      {
        caseNumber: item.caseNumber,
        clientName: item.clientName,
        priority: item.priority,
        status: item.status
      }
    );
    
    res.json(item);
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Failed to update case' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getDocumentById(COLLECTIONS.CASES, req.params.id);
    if (!existing || existing.owner !== req.user.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    await deleteDocument(COLLECTIONS.CASES, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Failed to delete case' });
  }
});

export default router;



