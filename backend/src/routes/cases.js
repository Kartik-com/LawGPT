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
import { validateHearingType } from '../schemas/validation-schemas.js';


const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const cases = await queryDocuments(
      MODELS.CASES,
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
    // Validate case number is provided (any format allowed)
    if (!req.body.caseNumber || typeof req.body.caseNumber !== 'string' || !req.body.caseNumber.trim()) {
      return res.status(400).json({ error: 'Case number is required' });
    }

    const trimmedCaseNumber = req.body.caseNumber.trim();

    // Check for duplicate case number (case-insensitive, same owner)
    const existingCases = await queryDocuments(COLLECTIONS.CASES, [
      { field: 'owner', operator: '==', value: req.user.userId },
      { field: 'caseNumber', operator: '==', value: trimmedCaseNumber }
    ]);

    if (existingCases.length > 0) {
      return res.status(409).json({ error: `Case number "${trimmedCaseNumber}" already exists. Please use a different case number.` });
    }

    // Hearing type validation is optional - don't block if not provided
    if (req.body.hearingType) {
      const hearingTypeValidation = validateHearingType(req.body.hearingType);
      if (!hearingTypeValidation.valid) {
        return res.status(400).json({ error: hearingTypeValidation.error });
      }
    }

    const data = { ...req.body, caseNumber: trimmedCaseNumber, owner: req.user.userId };
    const item = await createDocument(COLLECTIONS.CASES, data);

    try {
      const safeCaseNumber = (item.caseNumber || `Case ${item.id}`).replace(/[\\/]+/g, '-');
      const folderNameRaw = `${safeCaseNumber} - ${item.clientName || 'Client Documents'}`;
      const folderName = folderNameRaw.trim().substring(0, 120);

      const folder = await createDocument(COLLECTIONS.FOLDERS, {
        name: folderName || `Case ${item.id}`,
        ownerId: req.user.userId,
        parentId: null,
        caseId: item.id
      });

      await updateDocument(COLLECTIONS.CASES, item.id, { folderId: folder.id });
      item.folderId = folder.id;
    } catch (folderError) {
      console.error('Auto folder creation failed for case:', item.id, folderError);
      try {
        await deleteDocument(COLLECTIONS.CASES, item.id);
      } catch (cleanupError) {
        console.error('Failed to rollback case after folder creation error:', cleanupError);
      }
      return res.status(500).json({ error: 'Failed to create folder for the new case. Please try again.' });
    }

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
        status: item.status,
        folderId: item.folderId
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
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!item || String(item.owner) !== String(req.user.userId)) {
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
    // Compare as strings to handle ObjectId vs string inconsistencies
    if (!existing || String(existing.owner) !== String(req.user.userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Validate case number if being updated (any format allowed, just ensure it's not empty)
    if (req.body.caseNumber !== undefined) {
      if (!req.body.caseNumber || typeof req.body.caseNumber !== 'string' || !req.body.caseNumber.trim()) {
        return res.status(400).json({ error: 'Case number cannot be empty' });
      }

      const trimmedCaseNumber = req.body.caseNumber.trim();

      // Check for duplicate case number (excluding current case, same owner)
      const existingCases = await queryDocuments(COLLECTIONS.CASES, [
        { field: 'owner', operator: '==', value: req.user.userId },
        { field: 'caseNumber', operator: '==', value: trimmedCaseNumber }
      ]);

      // Filter out the current case being updated
      const duplicateCases = existingCases.filter(c => c.id !== req.params.id);
      if (duplicateCases.length > 0) {
        return res.status(409).json({ error: `Case number "${trimmedCaseNumber}" already exists. Please use a different case number.` });
      }

      req.body.caseNumber = trimmedCaseNumber;
    }

    // Validate hearing type if being updated
    if (req.body.hearingType) {
      const hearingTypeValidation = validateHearingType(req.body.hearingType);
      if (!hearingTypeValidation.valid) {
        return res.status(400).json({ error: hearingTypeValidation.error });
      }
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

// Migration endpoint to populate nextHearing from hearingDate for existing cases
router.post('/migrate-next-hearing', async (req, res) => {
  try {
    // Get all cases for the current user
    const cases = await queryDocuments(
      COLLECTIONS.CASES,
      [{ field: 'owner', operator: '==', value: req.user.userId }]
    );

    let updated = 0;
    let skipped = 0;

    // Update cases that have hearingDate but no nextHearing
    for (const caseItem of cases) {
      if (caseItem.hearingDate && !caseItem.nextHearing) {
        await updateDocument(COLLECTIONS.CASES, caseItem.id, {
          nextHearing: caseItem.hearingDate
        });
        updated++;
      } else {
        skipped++;
      }
    }

    res.json({
      success: true,
      message: `Migration complete: ${updated} cases updated, ${skipped} cases skipped`,
      updated,
      skipped,
      total: cases.length
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Failed to migrate cases' });
  }
});

export default router;
