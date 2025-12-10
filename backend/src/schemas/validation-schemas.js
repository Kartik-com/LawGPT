/**
 * Validation schemas and functions for LawGPT
 * Centralized validation logic for consistency across endpoints
 */

// Case number format: Flexible to support various legal formats
// Accepts: CASE-2024-00001, CC/2024/001, WP/123/2024, etc.
// Min 3 chars, allows alphanumeric, forward slashes, hyphens
const CASE_NUMBER_REGEX = /^[A-Za-z0-9\-\/]{3,30}$/;

// Indian mobile number: 10 digits starting with 6-9
const MOBILE_NUMBER_REGEX = /^[6-9]\d{9}$/;

// PAN card format: AAAAA9999A
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

// Aadhar number: 12 digits
const AADHAR_REGEX = /^\d{12}$/;

// Email format
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hearing type enum for cases
const HEARING_TYPES = [
    'Pre-trial',
    'Trial',
    'Appeal',
    'Hearing',
    'Other'
];

/**
 * Validate case number format
 * @param {string} caseNumber - Case number to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validateCaseNumber(caseNumber) {
    if (!caseNumber || typeof caseNumber !== 'string') {
        return { valid: false, error: 'Case number is required' };
    }

    const trimmed = caseNumber.trim();

    if (!CASE_NUMBER_REGEX.test(trimmed)) {
        return {
            valid: false,
            error: 'Case number format is invalid. Allowed characters: letters, numbers, hyphens, and slashes.'
        };
    }

    return { valid: true };
}

/**
 * Normalize and validate mobile number
 * @param {string} phone - Phone number to validate
 * @returns {object} { valid: boolean, normalized?: string, error?: string }
 */
function validateMobileNumber(phone) {
    if (!phone) {
        return { valid: false, error: 'Phone number is required' };
    }

    // Strip all non-numeric characters
    const normalized = phone.toString().replace(/\D/g, '');

    if (!MOBILE_NUMBER_REGEX.test(normalized)) {
        return {
            valid: false,
            error: 'Phone number must be 10 digits and start with 6-9'
        };
    }

    return { valid: true, normalized };
}

/**
 * Validate hearing type
 * @param {string} hearingType - Hearing type to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validateHearingType(hearingType) {
    if (!hearingType) {
        return { valid: false, error: 'Hearing type is required' };
    }

    if (!HEARING_TYPES.includes(hearingType)) {
        return {
            valid: false,
            error: `Hearing type must be one of: ${HEARING_TYPES.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate PAN number
 * @param {string} pan - PAN number to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validatePAN(pan) {
    if (!pan) {
        return { valid: true }; // PAN is optional
    }

    const normalized = pan.toString().toUpperCase().trim();

    if (!PAN_REGEX.test(normalized)) {
        return {
            valid: false,
            error: 'PAN must follow format AAAAA9999A (5 letters, 4 digits, 1 letter)'
        };
    }

    return { valid: true, normalized };
}

/**
 * Validate Aadhar number
 * @param {string} aadhar - Aadhar number to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validateAadhar(aadhar) {
    if (!aadhar) {
        return { valid: true }; // Aadhar is optional
    }

    const normalized = aadhar.toString().replace(/\D/g, '');

    if (!AADHAR_REGEX.test(normalized)) {
        return {
            valid: false,
            error: 'Aadhar number must be 12 digits'
        };
    }

    return { valid: true, normalized };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} { valid: boolean, error?: string }
 */
function validateEmail(email) {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }

    const trimmed = email.toString().trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmed)) {
        return {
            valid: false,
            error: 'Invalid email format'
        };
    }

    return { valid: true, normalized: trimmed };
}

/**
 * Generate a unique client code
 * @param {string} name - Client name
 * @param {Date} date - Date for the code (defaults to now)
 * @param {number} counter - Counter for uniqueness
 * @returns {string} Client code in format: name-slug-YYMMDD-NNN
 */
function generateClientCode(name, date = new Date(), counter = 1) {
    // Create slug from name (lowercase, replace spaces with hyphens, remove special chars)
    const slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 20); // Limit length

    // Format date as YYMMDD
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;

    // Format counter as 3-digit number
    const counterStr = counter.toString().padStart(3, '0');

    return `${slug}-${dateStr}-${counterStr}`;
}


export {
    // Regex patterns
    CASE_NUMBER_REGEX,
    MOBILE_NUMBER_REGEX,
    PAN_REGEX,
    AADHAR_REGEX,
    EMAIL_REGEX,

    // Enums
    HEARING_TYPES,

    // Validation functions
    validateCaseNumber,
    validateMobileNumber,
    validateHearingType,
    validatePAN,
    validateAadhar,
    validateEmail,

    // Utility functions
    generateClientCode
};

