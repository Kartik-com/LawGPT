/**
 * Hearing Conflict Detection Utilities
 * 
 * Provides server-side conflict detection for hearing scheduling.
 * Checks for overlapping hearings based on configurable resource scopes.
 */

import { queryDocuments, getDocumentById, MODELS, COLLECTIONS } from '../services/mongodb.js';

/**
 * Get active conflict scopes from environment configuration
 * @returns {string[]} Array of active conflict scopes
 */
export function getConflictScopes() {
    const scopesEnv = process.env.SCHEDULER_CONFLICT_SCOPES || 'courtroom,counsel';
    return scopesEnv.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Check if two time ranges overlap
 * @param {Date} start1 - Start of first range
 * @param {Date} end1 - End of first range
 * @param {Date} start2 - Start of second range
 * @param {Date} end2 - End of second range
 * @returns {boolean} True if ranges overlap
 */
export function checkTimeOverlap(start1, end1, start2, end2) {
    // Two intervals overlap if: newStart < existingEnd && existingStart < newEnd
    return start1 < end2 && start2 < end1;
}

/**
 * Convert local date/time to UTC timestamp
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @param {string} timezone - IANA timezone (e.g., 'Asia/Kolkata')
 * @returns {Date} UTC timestamp
 */
export function convertToUTC(date, time, timezone = 'Asia/Kolkata') {
    // Parse date and time
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    // Create local datetime
    const localDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);

    // Simplified timezone conversion (for production, use date-fns-tz or luxon)
    const timezoneOffsets = {
        'Asia/Kolkata': 5.5 * 60, // IST is UTC+5:30
        'Asia/Calcutta': 5.5 * 60, // Alternative name for IST
        'UTC': 0,
        'America/New_York': -5 * 60, // EST (simplified, doesn't handle DST)
        'Europe/London': 0, // GMT (simplified, doesn't handle BST)
    };

    const offsetMinutes = timezoneOffsets[timezone] || 0;
    const utcTimestamp = new Date(localDateTime.getTime() - offsetMinutes * 60 * 1000);

    return utcTimestamp;
}

/**
 * Compute startAt and endAt from hearingDate, hearingTime, and duration
 * @param {Date|string} hearingDate - Hearing date
 * @param {string} hearingTime - Hearing time (HH:MM)
 * @param {string} timezone - IANA timezone
 * @param {number} duration - Duration in minutes
 * @returns {{startAt: Date, endAt: Date}}
 */
export function computeHearingTimes(hearingDate, hearingTime, timezone, duration = 60) {
    // Convert hearingDate to YYYY-MM-DD format
    let dateObj;
    if (hearingDate?.toDate) {
        dateObj = hearingDate.toDate();
    } else if (hearingDate instanceof Date) {
        dateObj = hearingDate;
    } else {
        dateObj = new Date(hearingDate);
    }

    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = hearingTime || '10:00';

    const startAt = convertToUTC(dateStr, timeStr, timezone);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    return { startAt, endAt };
}

/**
 * Check for hearing conflicts
 * @param {string} userId - User ID
 * @param {Date} startAt - Start time (UTC)
 * @param {Date} endAt - End time (UTC)
 * @param {Object} resourceScope - Resource scope identifiers
 * @param {string} excludeHearingId - Hearing ID to exclude (for updates)
 * @returns {Promise<Array>} Array of conflicting hearings
 */
export async function checkHearingConflicts(userId, startAt, endAt, resourceScope = {}, excludeHearingId = null) {
    // Get active conflict scopes from config
    const conflictScopes = getConflictScopes();

    // Query all active hearings for the user
    const filters = [
        { field: 'owner', operator: '==', value: userId },
        { field: 'status', operator: 'in', value: ['scheduled', 'adjourned'] }
    ];

    const allHearings = await queryDocuments(COLLECTIONS.HEARINGS, filters);

    const conflicts = [];

    for (const hearing of allHearings) {
        // Skip the hearing being updated
        if (excludeHearingId && hearing.id === excludeHearingId) {
            continue;
        }

        // Skip hearings without startAt/endAt (legacy data)
        if (!hearing.startAt || !hearing.endAt) {
            // Compute from legacy fields if available
            if (hearing.hearingDate && hearing.hearingTime) {
                const computed = computeHearingTimes(
                    hearing.hearingDate,
                    hearing.hearingTime,
                    hearing.timezone || 'Asia/Kolkata',
                    hearing.duration || 60
                );
                hearing.startAt = computed.startAt;
                hearing.endAt = computed.endAt;
            } else {
                continue; // Skip if we can't determine times
            }
        }

        // Convert MongoDB/Mongoose Timestamps to Date objects
        const hearingStart = hearing.startAt?.toDate ? hearing.startAt.toDate() : new Date(hearing.startAt);
        const hearingEnd = hearing.endAt?.toDate ? hearing.endAt.toDate() : new Date(hearing.endAt);

        // Check time overlap
        const overlaps = checkTimeOverlap(startAt, endAt, hearingStart, hearingEnd);

        if (!overlaps) {
            continue;
        }

        // Check resource scope conflicts
        const scopeConflicts = [];

        if (conflictScopes.includes('courtroom') &&
            resourceScope.courtroomId &&
            hearing.resourceScope?.courtroomId === resourceScope.courtroomId) {
            scopeConflicts.push('Same courtroom');
        }

        if (conflictScopes.includes('counsel') &&
            resourceScope.counselId &&
            hearing.resourceScope?.counselId === resourceScope.counselId) {
            scopeConflicts.push('Same counsel');
        }

        if (conflictScopes.includes('client') &&
            resourceScope.clientId &&
            hearing.resourceScope?.clientId === resourceScope.clientId) {
            scopeConflicts.push('Same client');
        }

        // If global scope is enabled, any overlap is a conflict
        const isGlobalConflict = conflictScopes.includes('global');

        if (isGlobalConflict || scopeConflicts.length > 0) {
            // Get case number for conflict details
            let caseNumber = `Case ${hearing.caseId}`;
            try {
                const caseData = await getDocumentById(COLLECTIONS.CASES, hearing.caseId);
                if (caseData?.caseNumber) {
                    caseNumber = caseData.caseNumber;
                }
            } catch (err) {
                console.warn(`Could not fetch case ${hearing.caseId} for conflict details:`, err.message);
            }

            conflicts.push({
                hearingId: hearing.id,
                caseNumber,
                startAt: hearingStart,
                endAt: hearingEnd,
                conflictReason: scopeConflicts.length > 0 ? scopeConflicts.join(', ') : 'Time overlap',
                resourceScope: scopeConflicts
            });
        }
    }

    return conflicts;
}

/**
 * Validate hearing data before conflict check
 * @param {Object} hearingData - Hearing data to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateHearingData(hearingData) {
    const errors = [];

    if (!hearingData.startAt) {
        errors.push('startAt is required');
    }

    if (!hearingData.endAt) {
        errors.push('endAt is required');
    }

    if (hearingData.startAt && hearingData.endAt) {
        const start = new Date(hearingData.startAt);
        const end = new Date(hearingData.endAt);

        if (isNaN(start.getTime())) {
            errors.push('Invalid startAt date');
        }

        if (isNaN(end.getTime())) {
            errors.push('Invalid endAt date');
        }

        if (start >= end) {
            errors.push('endAt must be after startAt');
        }

        // Check if hearing is in the past (only for scheduled status)
        const now = new Date();
        if (hearingData.status === 'scheduled' && start < now) {
            errors.push('Hearing date cannot be in the past while status is scheduled');
        }
    }

    if (hearingData.duration && (hearingData.duration < 1 || hearingData.duration > 1440)) {
        errors.push('Duration must be between 1 and 1440 minutes');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
