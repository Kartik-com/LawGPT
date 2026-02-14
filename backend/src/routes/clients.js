import express from 'express';
import { requireAuth } from '../middleware/auth-jwt.js';
import { logActivity } from '../middleware/activityLogger.js';
import {
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  queryDocuments,
  MODELS,
  COLLECTIONS
} from '../services/mongodb.js';
import { validateMobileNumber, validateEmail, validatePAN, validateAadhar, generateClientCode } from '../schemas/validation-schemas.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const clients = await queryDocuments(
      MODELS.CLIENTS,
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
    if (!req.body.name || !req.body.email || !req.body.phone) {
      return res.status(400).json({ error: 'Name, email, and phone are required' });
    }

    // Validate email
    const emailValidation = validateEmail(req.body.email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Validate and normalize mobile number
    const phoneValidation = validateMobileNumber(req.body.phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ error: phoneValidation.error });
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

    const normalizedEmail = emailValidation.normalized;
    const normalizedPhone = phoneValidation.normalized;
    const normalizedName = req.body.name.trim();

    // Check for duplicate email (same owner)
    const existingByEmail = await queryDocuments(COLLECTIONS.CLIENTS, [
      { field: 'owner', operator: '==', value: req.user.userId },
      { field: 'email', operator: '==', value: normalizedEmail }
    ]);

    if (existingByEmail.length > 0) {
      return res.status(409).json({ error: `Email "${normalizedEmail}" is already registered to another client. Please use a different email address.` });
    }

    // Check for duplicate phone number (same owner)
    const existingByPhone = await queryDocuments(COLLECTIONS.CLIENTS, [
      { field: 'owner', operator: '==', value: req.user.userId },
      { field: 'phone', operator: '==', value: normalizedPhone }
    ]);

    if (existingByPhone.length > 0) {
      return res.status(409).json({ error: `Phone number "${normalizedPhone}" is already registered to another client. Please use a different phone number.` });
    }

    // Check for duplicate client name (same owner, case-insensitive)
    const existingByName = await queryDocuments(COLLECTIONS.CLIENTS, [
      { field: 'owner', operator: '==', value: req.user.userId }
    ]);

    const duplicateName = existingByName.find(c => c.name && c.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (duplicateName) {
      return res.status(409).json({ error: `Client name "${normalizedName}" already exists. Please use a different name or add a distinguishing identifier.` });
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
      name: normalizedName,
      owner: req.user.userId,
      email: normalizedEmail,
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

    // Check for duplicate email if being updated
    if (req.body.email) {
      const emailValidation = validateEmail(req.body.email);
      if (!emailValidation.valid) {
        return res.status(400).json({ error: emailValidation.error });
      }

      const normalizedEmail = emailValidation.normalized;
      const existingByEmail = await queryDocuments(COLLECTIONS.CLIENTS, [
        { field: 'owner', operator: '==', value: req.user.userId },
        { field: 'email', operator: '==', value: normalizedEmail }
      ]);

      // Filter out the current client being updated
      const duplicateEmail = existingByEmail.find(c => c.id !== req.params.id);
      if (duplicateEmail) {
        return res.status(409).json({ error: `Email "${normalizedEmail}" is already registered to another client. Please use a different email address.` });
      }

      req.body.email = normalizedEmail;
    }

    // Check for duplicate phone number if being updated
    if (req.body.phone) {
      const phoneValidation = validateMobileNumber(req.body.phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }

      const normalizedPhone = phoneValidation.normalized;
      const existingByPhone = await queryDocuments(COLLECTIONS.CLIENTS, [
        { field: 'owner', operator: '==', value: req.user.userId },
        { field: 'phone', operator: '==', value: normalizedPhone }
      ]);

      // Filter out the current client being updated
      const duplicatePhone = existingByPhone.find(c => c.id !== req.params.id);
      if (duplicatePhone) {
        return res.status(409).json({ error: `Phone number "${normalizedPhone}" is already registered to another client. Please use a different phone number.` });
      }

      req.body.phone = normalizedPhone;
    }

    // Check for duplicate client name if being updated
    if (req.body.name) {
      const normalizedName = req.body.name.trim();
      const existingByName = await queryDocuments(COLLECTIONS.CLIENTS, [
        { field: 'owner', operator: '==', value: req.user.userId }
      ]);

      // Filter out the current client being updated
      const duplicateName = existingByName.find(c =>
        c.id !== req.params.id &&
        c.name &&
        c.name.trim().toLowerCase() === normalizedName.toLowerCase()
      );

      if (duplicateName) {
        return res.status(409).json({ error: `Client name "${normalizedName}" already exists. Please use a different name or add a distinguishing identifier.` });
      }

      req.body.name = normalizedName;
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



