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
    const clients = await queryDocuments(
      COLLECTIONS.CLIENTS,
      [{ field: 'owner', operator: '==', value: req.user.userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch clients',
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
    const client = await createDocument(COLLECTIONS.CLIENTS, data);
    
    // Log activity
    await logActivity(
      req.user.userId,
      'client_registered',
      `New client ${client.name} registered`,
      'client',
      client.id,
      {
        clientName: client.name,
        email: client.email,
        phone: client.phone
      }
    );
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await getDocumentById(COLLECTIONS.CLIENTS, req.params.id);
    if (!existing || existing.owner !== req.user.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const client = await updateDocument(COLLECTIONS.CLIENTS, req.params.id, req.body);
    
    // Log activity
    await logActivity(
      req.user.userId,
      'client_updated',
      `Client ${client.name} information updated`,
      'client',
      client.id,
      {
        clientName: client.name,
        email: client.email
      }
    );
    
    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await getDocumentById(COLLECTIONS.CLIENTS, req.params.id);
    if (!existing || existing.owner !== req.user.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    await deleteDocument(COLLECTIONS.CLIENTS, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;



