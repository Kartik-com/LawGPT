/**
 * Formatting utilities for currency and dates based on user preferences
 */

// Currency symbols and formats
const CURRENCY_SYMBOLS = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
} as const;

const CURRENCY_LOCALES = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    AED: 'ar-AE',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;
export type DateFormatType = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

/**
 * Format currency based on user's currency preference
 */
export function formatCurrency(
    amount: number,
    currency: CurrencyCode = 'INR',
    options?: {
        showSymbol?: boolean;
        decimals?: number;
    }
): string {
    const { showSymbol = true, decimals = 2 } = options || {};

    const symbol = CURRENCY_SYMBOLS[currency];
    const locale = CURRENCY_LOCALES[currency];

    // Format number with locale-specific formatting
    const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount);

    return showSymbol ? `${symbol}${formatted}` : formatted;
}

/**
 * Format date based on user's date format preference
 */
export function formatDate(
    date: Date | string | number,
    format: DateFormatType = 'DD/MM/YYYY',
    options?: {
        includeTime?: boolean;
        timeFormat?: '12h' | '24h';
    }
): string {
    const { includeTime = false, timeFormat = '12h' } = options || {};

    // Convert to Date object if needed
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();

    let formattedDate: string;

    switch (format) {
        case 'DD/MM/YYYY':
            formattedDate = `${day}/${month}/${year}`;
            break;
        case 'MM/DD/YYYY':
            formattedDate = `${month}/${day}/${year}`;
            break;
        case 'YYYY-MM-DD':
            formattedDate = `${year}-${month}-${day}`;
            break;
        default:
            formattedDate = `${day}/${month}/${year}`;
    }

    if (includeTime) {
        const hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');

        if (timeFormat === '12h') {
            const period = hours >= 12 ? 'PM' : 'AM';
            const hours12 = hours % 12 || 12;
            formattedDate += ` ${hours12}:${minutes} ${period}`;
        } else {
            const hours24 = String(hours).padStart(2, '0');
            formattedDate += ` ${hours24}:${minutes}`;
        }
    }

    return formattedDate;
}

/**
 * Format date for display (short format)
 */
export function formatDateShort(
    date: Date | string | number,
    format: DateFormatType = 'DD/MM/YYYY'
): string {
    return formatDate(date, format, { includeTime: false });
}

/**
 * Format date with time
 */
export function formatDateTime(
    date: Date | string | number,
    format: DateFormatType = 'DD/MM/YYYY',
    timeFormat: '12h' | '24h' = '12h'
): string {
    return formatDate(date, format, { includeTime: true, timeFormat });
}

/**
 * Format relative date (e.g., "2 days ago", "in 3 hours")
 */
export function formatRelativeDate(date: Date | string | number): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) {
        return 'just now';
    } else if (diffMin < 60) {
        return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
        return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
        return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
    } else if (diffWeek < 4) {
        return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
    } else if (diffMonth < 12) {
        return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffYear} year${diffYear !== 1 ? 's' : ''} ago`;
    }
}

/**
 * Parse date string based on format
 */
export function parseDate(dateStr: string, format: DateFormatType = 'DD/MM/YYYY'): Date | null {
    const parts = dateStr.split(/[\/\-]/);

    if (parts.length !== 3) {
        return null;
    }

    let day: number, month: number, year: number;

    switch (format) {
        case 'DD/MM/YYYY':
            [day, month, year] = parts.map(Number);
            break;
        case 'MM/DD/YYYY':
            [month, day, year] = parts.map(Number);
            break;
        case 'YYYY-MM-DD':
            [year, month, day] = parts.map(Number);
            break;
        default:
            return null;
    }

    // Validate
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return null;
    }

    // Month is 0-indexed in JavaScript Date
    const date = new Date(year, month - 1, day);

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}

/**
 * Format number with locale-specific formatting
 */
export function formatNumber(
    value: number,
    locale: string = 'en-IN',
    options?: Intl.NumberFormatOptions
): string {
    return new Intl.NumberFormat(locale, options).format(value);
}
