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
import {
  checkHearingConflicts,
  computeHearingTimes,
  validateHearingData
} from '../utils/conflictDetection.js';

const router = express.Router();

router.use(requireAuth);

const normalizeDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const isBeforeToday = (date) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return date < startOfToday;
};

// Check for hearing conflicts
router.post('/check-conflict', async (req, res) => {
  try {
    const { startAt, endAt, timezone, resourceScope, excludeHearingId } = req.body;

    // Validate required fields
    if (!startAt || !endAt) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'startAt and endAt are required'
      });
    }

    // Parse dates
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid date format'
      });
    }

    if (start >= end) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'endAt must be after startAt'
      });
    }

    // Check for conflicts
    const conflicts = await checkHearingConflicts(
      req.user.userId,
      start,
      end,
      resourceScope || {},
      excludeHearingId
    );

    res.json({
      hasConflict: conflicts.length > 0,
      conflicts
    });
  } catch (error) {
    console.error('Check conflict error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to check conflicts'
    });
  }
});

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
    const normalizedHearingDate = normalizeDateInput(req.body.hearingDate);
    if (!normalizedHearingDate) {
      return res.status(400).json({ error: 'Valid hearing date is required' });
    }

    // Only block past dates for scheduled hearings (upcoming hearings)
    // Allow past dates for completed, adjourned, or cancelled hearings (historical data)
    const status = req.body.status || 'scheduled';
    if (status === 'scheduled' && isBeforeToday(normalizedHearingDate)) {
      return res.status(400).json({ error: 'Hearing date cannot be in the past for scheduled hearings' });
    }

    let normalizedNextHearingDate = null;
    if (req.body.nextHearingDate) {
      normalizedNextHearingDate = normalizeDateInput(req.body.nextHearingDate);
      if (!normalizedNextHearingDate) {
        return res.status(400).json({ error: 'Invalid next hearing date' });
      }
      if (isBeforeToday(normalizedNextHearingDate)) {
        return res.status(400).json({ error: 'Next hearing date cannot be in the past' });
      }
    }

    // Compute startAt and endAt from hearingDate, hearingTime, timezone
    const timezone = req.body.timezone || 'Asia/Kolkata';
    const hearingTime = req.body.hearingTime || '10:00';
    const duration = req.body.duration || 60;

    const { startAt, endAt } = computeHearingTimes(
      normalizedHearingDate,
      hearingTime,
      timezone,
      duration
    );

    const data = {
      ...req.body,
      owner: req.user.userId,
      hearingDate: normalizedHearingDate,
      timezone,
      startAt,
      endAt,
      duration
    };

    if (normalizedNextHearingDate) {
      data.nextHearingDate = normalizedNextHearingDate;
    } else if (req.body.nextHearingDate === null) {
      data.nextHearingDate = null;
    }

    // Check for conflicts (unless override is explicitly allowed)
    const override = req.body.override === true;
    const conflicts = await checkHearingConflicts(
      req.user.userId,
      startAt,
      endAt,
      req.body.resourceScope || {},
      null // No excludeHearingId for new hearings
    );

    if (conflicts.length > 0 && !override) {
      // Return conflict error
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Hearing conflicts with existing schedules',
        conflicts: conflicts.map(c => ({
          hearingId: c.hearingId,
          caseNumber: c.caseNumber,
          startAt: c.startAt.toISOString(),
          endAt: c.endAt.toISOString(),
          conflictReason: c.conflictReason
        }))
      });
    }

    // If override is requested, validate and record it
    if (override) {
      if (!req.body.overrideReason || !req.body.overrideReason.trim()) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Override reason is required when forcing a conflicting hearing'
        });
      }

      data.conflictOverride = {
        allowed: true,
        reason: req.body.overrideReason.trim(),
        overriddenBy: req.user.userId,
        overriddenAt: new Date(),
        conflictingHearings: conflicts.map(c => c.hearingId)
      };

      // Log override activity
      await logActivity(
        req.user.userId,
        'hearing_conflict_override',
        `Hearing scheduled despite ${conflicts.length} conflict(s): ${req.body.overrideReason}`,
        'hearing',
        null,
        {
          conflicts: conflicts.length,
          reason: req.body.overrideReason,
          conflictingHearings: conflicts.map(c => c.hearingId)
        }
      );
    }

    const hearing = await createDocument(COLLECTIONS.HEARINGS, data);

    // Update the Case's nextHearing field to reflect the latest upcoming hearing
    if (hearing.caseId) {
      try {
        // Get all hearings for this case
        const caseHearings = await queryDocuments(
          COLLECTIONS.HEARINGS,
          [
            { field: 'caseId', operator: '==', value: hearing.caseId },
            { field: 'owner', operator: '==', value: req.user.userId }
          ]
        );

        const now = new Date();
        const futureDates = [];

        // Collect all future dates from hearings
        caseHearings.forEach(h => {
          // If hearing has a nextHearingDate set, use that
          if (h.nextHearingDate) {
            const nextDate = h.nextHearingDate?.toDate ? h.nextHearingDate.toDate() : new Date(h.nextHearingDate);
            if (nextDate >= now) {
              futureDates.push(nextDate);
            }
          }

          // Also include scheduled hearings based on their hearingDate
          if (h.status === 'scheduled' && h.hearingDate) {
            const hDate = h.hearingDate?.toDate ? h.hearingDate.toDate() : new Date(h.hearingDate);
            if (hDate >= now) {
              futureDates.push(hDate);
            }
          }
        });

        // Find the earliest future date
        const nextHearingDate = futureDates.length > 0
          ? futureDates.sort((a, b) => a - b)[0]
          : null;

        console.log('[Hearing Create] Calculated nextHearing for case:', hearing.caseId, 'Date:', nextHearingDate);

        // Update the case's nextHearing field
        await updateDocument(COLLECTIONS.CASES, hearing.caseId, {
          nextHearing: nextHearingDate
        });
      } catch (caseUpdateError) {
        console.error('Failed to update case nextHearing:', caseUpdateError);
        // Don't fail the hearing creation if case update fails
      }
    }

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
        status: hearing.status,
        hasConflictOverride: override
      }
    );

    res.status(201).json(hearing);
  } catch (error) {
    console.error('Create hearing error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Failed to create hearing', details: error.message });
  }
});

// Update a hearing
router.put('/:id', async (req, res) => {
  try {
    const original = await getDocumentById(COLLECTIONS.HEARINGS, req.params.id);
    if (!original) return res.status(404).json({ error: 'Hearing not found' });

    // Debug ownership check
    console.log('[Hearing Update] Ownership check:', {
      hearingId: req.params.id,
      hearingOwner: original.owner,
      hearingOwnerType: typeof original.owner,
      currentUser: req.user.userId,
      currentUserType: typeof req.user.userId,
      match: String(original.owner) === String(req.user.userId)
    });

    // Compare as strings to handle ObjectId vs string inconsistencies
    if (String(original.owner) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = { ...req.body };
    const resultingStatus = updates.status || original.status;

    if (updates.hearingDate) {
      const normalized = normalizeDateInput(updates.hearingDate);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid hearing date' });
      }
      if (resultingStatus === 'scheduled' && isBeforeToday(normalized)) {
        return res.status(400).json({ error: 'Hearing date cannot be in the past while scheduled' });
      }
      updates.hearingDate = normalized;
    }

    if (updates.nextHearingDate !== undefined) {
      if (!updates.nextHearingDate) {
        updates.nextHearingDate = null;
      } else {
        const normalizedNext = normalizeDateInput(updates.nextHearingDate);
        if (!normalizedNext) {
          return res.status(400).json({ error: 'Invalid next hearing date' });
        }
        if (isBeforeToday(normalizedNext)) {
          return res.status(400).json({ error: 'Next hearing date cannot be in the past' });
        }
        updates.nextHearingDate = normalizedNext;
      }
    }

    // Recompute startAt/endAt if date, time, timezone, or duration changed
    const dateChanged = updates.hearingDate !== undefined;
    const timeChanged = updates.hearingTime !== undefined;
    const timezoneChanged = updates.timezone !== undefined;
    const durationChanged = updates.duration !== undefined;

    if (dateChanged || timeChanged || timezoneChanged || durationChanged) {
      const hearingDate = updates.hearingDate || original.hearingDate;
      const hearingTime = updates.hearingTime || original.hearingTime || '10:00';
      const timezone = updates.timezone || original.timezone || 'Asia/Kolkata';
      const duration = updates.duration || original.duration || 60;

      const { startAt, endAt } = computeHearingTimes(
        hearingDate,
        hearingTime,
        timezone,
        duration
      );

      updates.startAt = startAt;
      updates.endAt = endAt;
      updates.timezone = timezone;
      updates.duration = duration;
    }

    // Check for conflicts if time-related fields changed
    if (updates.startAt && updates.endAt) {
      const override = req.body.override === true;
      const conflicts = await checkHearingConflicts(
        req.user.userId,
        updates.startAt,
        updates.endAt,
        updates.resourceScope || original.resourceScope || {},
        req.params.id // Exclude this hearing from conflict check
      );

      if (conflicts.length > 0 && !override) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'Hearing update conflicts with existing schedules',
          conflicts: conflicts.map(c => ({
            hearingId: c.hearingId,
            caseNumber: c.caseNumber,
            startAt: c.startAt.toISOString(),
            endAt: c.endAt.toISOString(),
            conflictReason: c.conflictReason
          }))
        });
      }

      // If override is requested, validate and record it
      if (override) {
        if (!req.body.overrideReason || !req.body.overrideReason.trim()) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Override reason is required when forcing a conflicting hearing'
          });
        }

        updates.conflictOverride = {
          allowed: true,
          reason: req.body.overrideReason.trim(),
          overriddenBy: req.user.userId,
          overriddenAt: new Date(),
          conflictingHearings: conflicts.map(c => c.hearingId)
        };

        // Log override activity
        await logActivity(
          req.user.userId,
          'hearing_conflict_override',
          `Hearing updated despite ${conflicts.length} conflict(s): ${req.body.overrideReason}`,
          'hearing',
          req.params.id,
          {
            conflicts: conflicts.length,
            reason: req.body.overrideReason,
            conflictingHearings: conflicts.map(c => c.hearingId)
          }
        );
      }
    }

    const hearing = await updateDocument(COLLECTIONS.HEARINGS, req.params.id, updates);

    // Update the Case's nextHearing field to reflect the latest upcoming hearing
    if (hearing.caseId) {
      try {
        // Get all hearings for this case
        const caseHearings = await queryDocuments(
          COLLECTIONS.HEARINGS,
          [
            { field: 'caseId', operator: '==', value: hearing.caseId },
            { field: 'owner', operator: '==', value: req.user.userId }
          ]
        );

        const now = new Date();
        const futureDates = [];

        // Collect all future dates from hearings
        caseHearings.forEach(h => {
          // If hearing has a nextHearingDate set, use that
          if (h.nextHearingDate) {
            const nextDate = h.nextHearingDate?.toDate ? h.nextHearingDate.toDate() : new Date(h.nextHearingDate);
            if (nextDate >= now) {
              futureDates.push(nextDate);
            }
          }

          // Also include scheduled hearings based on their hearingDate
          if (h.status === 'scheduled' && h.hearingDate) {
            const hDate = h.hearingDate?.toDate ? h.hearingDate.toDate() : new Date(h.hearingDate);
            if (hDate >= now) {
              futureDates.push(hDate);
            }
          }
        });

        // Find the earliest future date
        const nextHearingDate = futureDates.length > 0
          ? futureDates.sort((a, b) => a - b)[0]
          : null;

        console.log('[Hearing Update] Calculated nextHearing for case:', hearing.caseId, 'Date:', nextHearingDate);

        // Update the case's nextHearing field
        await updateDocument(COLLECTIONS.CASES, hearing.caseId, {
          nextHearing: nextHearingDate
        });
      } catch (caseUpdateError) {
        console.error('Failed to update case nextHearing:', caseUpdateError);
        // Don't fail the hearing update if case update fails
      }
    }

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

    // Compare as strings to handle ObjectId vs string inconsistencies
    if (String(hearing.owner) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await deleteDocument(COLLECTIONS.HEARINGS, req.params.id);

    // Update the Case's nextHearing field after deletion
    if (hearing.caseId) {
      try {
        // Get remaining hearings for this case
        const caseHearings = await queryDocuments(
          COLLECTIONS.HEARINGS,
          [
            { field: 'caseId', operator: '==', value: hearing.caseId },
            { field: 'owner', operator: '==', value: req.user.userId }
          ]
        );

        const now = new Date();
        const futureDates = [];

        // Collect all future dates from hearings
        caseHearings.forEach(h => {
          // If hearing has a nextHearingDate set, use that
          if (h.nextHearingDate) {
            const nextDate = h.nextHearingDate?.toDate ? h.nextHearingDate.toDate() : new Date(h.nextHearingDate);
            if (nextDate >= now) {
              futureDates.push(nextDate);
            }
          }

          // Also include scheduled hearings based on their hearingDate
          if (h.status === 'scheduled' && h.hearingDate) {
            const hDate = h.hearingDate?.toDate ? h.hearingDate.toDate() : new Date(h.hearingDate);
            if (hDate >= now) {
              futureDates.push(hDate);
            }
          }
        });

        // Find the earliest future date
        const nextHearingDate = futureDates.length > 0
          ? futureDates.sort((a, b) => a - b)[0]
          : null;

        console.log('[Hearing Delete] Calculated nextHearing for case:', hearing.caseId, 'Date:', nextHearingDate);

        // Update the case's nextHearing field
        await updateDocument(COLLECTIONS.CASES, hearing.caseId, {
          nextHearing: nextHearingDate
        });
      } catch (caseUpdateError) {
        console.error('Failed to update case nextHearing after deletion:', caseUpdateError);
        // Don't fail the hearing deletion if case update fails
      }
    }

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

