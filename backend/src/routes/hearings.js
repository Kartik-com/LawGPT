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

// Get all hearings for a specific case
router.get('/case/:caseId', async (req, res) => {
  try {
    const hearings = await queryDocuments(
      COLLECTIONS.HEARINGS,
      [
        { field: 'caseId', operator: '==', value: req.params.caseId },
        { field: 'owner', operator: '==', value: req.user.userId }
      ],
      { field: 'hearingDate', direction: 'desc' }
    );
    res.json(hearings);
  } catch (error) {
    console.error('Get hearings error:', error);
    res.status(500).json({ error: 'Failed to fetch hearings' });
  }
});

// Get all hearings for the user
router.get('/', async (req, res) => {
  try {
    const hearings = await queryDocuments(
      COLLECTIONS.HEARINGS,
      [{ field: 'owner', operator: '==', value: req.user.userId }],
      { field: 'hearingDate', direction: 'desc' }
    );
    
    // Populate case info
    const hearingsWithCases = await Promise.all(hearings.map(async (hearing) => {
      if (hearing.caseId) {
        try {
          const case_ = await getDocumentById(COLLECTIONS.CASES, hearing.caseId);
          return {
            ...hearing,
            caseId: case_ ? {
              caseNumber: case_.caseNumber,
              clientName: case_.clientName
            } : hearing.caseId
          };
        } catch (err) {
          // If case not found, return hearing without populated case
          return hearing;
        }
      }
      return hearing;
    }));
    
    res.json(hearingsWithCases);
  } catch (error) {
    console.error('Get all hearings error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    res.status(500).json({ 
      error: 'Failed to fetch hearings',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        code: error.code
      })
    });
  }
});

// Get a specific hearing
router.get('/:id', async (req, res) => {
  try {
    const hearing = await getDocumentById(COLLECTIONS.HEARINGS, req.params.id);
    
    if (!hearing) return res.status(404).json({ error: 'Hearing not found' });
    if (hearing.owner !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    
    // Populate case info
    if (hearing.caseId) {
      const case_ = await getDocumentById(COLLECTIONS.CASES, hearing.caseId);
      hearing.caseId = case_ ? {
        caseNumber: case_.caseNumber,
        clientName: case_.clientName
      } : hearing.caseId;
    }
    
    res.json(hearing);
  } catch (error) {
    console.error('Get hearing error:', error);
    res.status(500).json({ error: 'Failed to fetch hearing' });
  }
});

// Create a new hearing
router.post('/', async (req, res) => {
  try {
    const data = { ...req.body, owner: req.user.userId };
    const hearing = await createDocument(COLLECTIONS.HEARINGS, data);
    
    // Log activity
    const hearingDate = hearing.hearingDate?.toDate ? hearing.hearingDate.toDate() : new Date(hearing.hearingDate);
    await logActivity(
      req.user.userId,
      'hearing_created',
      `New hearing scheduled for case ${hearing.caseId} on ${hearingDate.toLocaleDateString()}`,
      'hearing',
      hearing.id,
      {
        caseId: hearing.caseId,
        hearingDate: hearingDate,
        hearingType: hearing.hearingType,
        status: hearing.status
      }
    );
    
    res.status(201).json(hearing);
  } catch (error) {
    console.error('Create hearing error:', error);
    res.status(500).json({ error: 'Failed to create hearing', details: error.message });
  }
});

// Update a hearing
router.put('/:id', async (req, res) => {
  try {
    const original = await getDocumentById(COLLECTIONS.HEARINGS, req.params.id);
    if (!original) return res.status(404).json({ error: 'Hearing not found' });
    if (original.owner !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    
    const hearing = await updateDocument(COLLECTIONS.HEARINGS, req.params.id, req.body);
    
    // Populate case info
    if (hearing.caseId) {
      const case_ = await getDocumentById(COLLECTIONS.CASES, hearing.caseId);
      hearing.caseId = case_ ? {
        caseNumber: case_.caseNumber,
        clientName: case_.clientName
      } : hearing.caseId;
    }
    
    // Log activity
    const hearingDate = hearing.hearingDate?.toDate ? hearing.hearingDate.toDate() : new Date(hearing.hearingDate);
    const caseNumber = typeof hearing.caseId === 'object' ? hearing.caseId?.caseNumber : hearing.caseId;
    await logActivity(
      req.user.userId,
      'hearing_updated',
      `Hearing updated for case ${caseNumber || hearing.caseId} on ${hearingDate.toLocaleDateString()}`,
      'hearing',
      hearing.id,
      {
        caseId: hearing.caseId,
        hearingDate: hearingDate,
        hearingType: hearing.hearingType,
        status: hearing.status
      }
    );
    
    res.json(hearing);
  } catch (error) {
    console.error('Update hearing error:', error);
    res.status(500).json({ error: 'Failed to update hearing', details: error.message });
  }
});

// Delete a hearing
router.delete('/:id', async (req, res) => {
  try {
    const hearing = await getDocumentById(COLLECTIONS.HEARINGS, req.params.id);
    
    if (!hearing) {
      return res.status(404).json({ error: 'Hearing not found' });
    }
    
    if (hearing.owner !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    await deleteDocument(COLLECTIONS.HEARINGS, req.params.id);
    
    // Log activity
    const hearingDate = hearing.hearingDate?.toDate ? hearing.hearingDate.toDate() : new Date(hearing.hearingDate);
    await logActivity(
      req.user.userId,
      'hearing_deleted',
      `Hearing deleted for case ${hearing.caseId} on ${hearingDate.toLocaleDateString()}`,
      'hearing',
      hearing.id,
      {
        caseId: hearing.caseId,
        hearingDate: hearingDate,
        hearingType: hearing.hearingType
      }
    );
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete hearing error:', error);
    res.status(500).json({ error: 'Failed to delete hearing', details: error.message });
  }
});

// Get today's hearings
router.get('/today/list', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const allHearings = await queryDocuments(
      COLLECTIONS.HEARINGS,
      [{ field: 'owner', operator: '==', value: req.user.userId }]
    );
    
    const todaysHearings = allHearings.filter(hearing => {
      if (!hearing.hearingDate) return false;
      const hearingDate = hearing.hearingDate.toDate ? hearing.hearingDate.toDate() : new Date(hearing.hearingDate);
      return hearingDate >= today && hearingDate < tomorrow;
    }).sort((a, b) => {
      const aTime = a.hearingTime || '';
      const bTime = b.hearingTime || '';
      return aTime.localeCompare(bTime);
    });
    
    // Populate case info
    const hearingsWithCases = await Promise.all(todaysHearings.map(async (hearing) => {
      if (hearing.caseId) {
        const case_ = await getDocumentById(COLLECTIONS.CASES, hearing.caseId);
        return {
          ...hearing,
          caseId: case_ ? {
            caseNumber: case_.caseNumber,
            clientName: case_.clientName
          } : hearing.caseId
        };
      }
      return hearing;
    }));
    
    res.json(hearingsWithCases);
  } catch (error) {
    console.error('Get today hearings error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s hearings' });
  }
});

export default router;

