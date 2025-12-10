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
import { validateMobileNumber, validateEmail, validatePAN, validateAadhar, generateClientCode } from '../schemas/validation-schemas.js';

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
    // Validate required fields
    if (!req.body.name || !req.body.email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Validate email
    const emailValidation = validateEmail(req.body.email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Validate and normalize mobile number (if provided)
    let normalizedPhone = '';
    if (req.body.phone && req.body.phone.trim()) {
      const phoneValidation = validateMobileNumber(req.body.phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }
      normalizedPhone = phoneValidation.normalized;
    }

    // Validate PAN if provided
    if (req.body.panNumber) {
      const panValidation = validatePAN(req.body.panNumber);
      if (!panValidation.valid) {
        return res.status(400).json({ error: panValidation.error });
      }
      req.body.panNumber = panValidation.normalized;
    }

    // Validate Aadhar if provided
    if (req.body.aadharNumber) {
      const aadharValidation = validateAadhar(req.body.aadharNumber);
      if (!aadharValidation.valid) {
        return res.status(400).json({ error: aadharValidation.error });
      }
      req.body.aadharNumber = aadharValidation.normalized;
    }

    // Generate unique client code
    let clientCode = generateClientCode(req.body.name);
    let counter = 1;

    // Check for uniqueness (simple approach - in production, use database constraint)
    while (true) {
      const existing = await queryDocuments(COLLECTIONS.CLIENTS, [
        { field: 'clientCode', operator: '==', value: clientCode }
      ]);
      if (existing.length === 0) break;
      counter++;
      clientCode = generateClientCode(req.body.name, new Date(), counter);
    }

    const data = {
      ...req.body,
      owner: req.user.userId,
      email: emailValidation.normalized,
      phone: normalizedPhone,
      clientCode
    };
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

// Get all cases for a specific client
router.get('/:id/cases', requireAuth, async (req, res) => {
  try {
    const clientId = req.params.id;
    const ownerId = req.user.userId;

    // Verify client exists and belongs to user
    const client = await getDocumentById(COLLECTIONS.CLIENTS, clientId);
    if (!client || client.owner !== ownerId) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get query parameters for filtering and pagination
    const { hearingType, status, caseType, limit = 50, offset = 0 } = req.query;

    // Build filters
    const filters = [
      { field: 'owner', operator: '==', value: ownerId }
    ];

    // For now, filter by clientName (will be clientId after migration)
    // This supports both old (clientName) and new (clientId) schema
    if (client.name) {
      filters.push({ field: 'clientName', operator: '==', value: client.name });
    }

    // Query cases
    let cases = await queryDocuments(
      COLLECTIONS.CASES,
      filters,
      { field: 'createdAt', direction: 'desc' }
    );

    // Apply additional filters client-side (until we have compound indexes)
    if (hearingType) {
      cases = cases.filter(c => c.hearingType === hearingType);
    }
    if (status) {
      cases = cases.filter(c => c.status === status);
    }
    if (caseType) {
      cases = cases.filter(c => c.caseType === caseType);
    }

    // Apply pagination
    const total = cases.length;
    const paginatedCases = cases.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      cases: paginatedCases,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    });
  } catch (error) {
    console.error('Get client cases error:', error);
    res.status(500).json({ error: 'Failed to fetch client cases' });
  }
});


export default router;



