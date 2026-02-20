import express from 'express';
import { requireAuth } from '../middleware/auth-jwt.js';
import { logActivity } from '../middleware/activityLogger.js';
import {
  createDocument,
  getDocumentById,
  deleteDocument,
  queryDocuments,
  MODELS,
  COLLECTIONS
} from '../services/mongodb.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const items = await queryDocuments(
      MODELS.TIME_ENTRIES,
      [{ field: 'owner', operator: '==', value: req.user.userId }],
      { field: 'createdAt', direction: 'desc' }
    );
    res.json(items);
  } catch (error) {
    console.error('Get time entries error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    res.status(500).json({
      error: 'Failed to fetch time entries',
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
    const item = await createDocument(COLLECTIONS.TIME_ENTRIES, data);

    // Get case info for activity log
    const case_ = item.caseId ? await getDocumentById(COLLECTIONS.CASES, item.caseId) : null;

    // Log activity - assuming duration is in minutes
    const durationInMinutes = item.duration;
    const durationText = durationInMinutes >= 60
      ? `${Math.floor(durationInMinutes / 60)}h ${durationInMinutes % 60}m`
      : `${durationInMinutes}m`;

    await logActivity(
      req.user.userId,
      'time_logged',
      `${durationText} logged for ${case_?.caseNumber || 'case'}`,
      'time_entry',
      item.id,
      {
        duration: item.duration, // Store original duration in minutes
        durationText: durationText, // Store formatted duration for display
        description: item.description,
        caseNumber: case_?.caseNumber,
        billable: item.billable,
        hourlyRate: item.hourlyRate
      }
    );

    res.status(201).json(item);
  } catch (error) {
    console.error('Create time entry error:', error);
    res.status(500).json({ error: 'Failed to create time entry' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await getDocumentById(COLLECTIONS.TIME_ENTRIES, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.owner?.toString() !== req.user.userId.toString()) return res.status(403).json({ error: 'Forbidden' });

    await deleteDocument(COLLECTIONS.TIME_ENTRIES, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete time entry error:', error);
    res.status(500).json({ error: 'Failed to delete time entry' });
  }
});

export default router;



