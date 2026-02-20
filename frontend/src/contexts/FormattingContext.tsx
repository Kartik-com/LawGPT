import React, { createContext, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    formatCurrency as formatCurrencyUtil,
    formatDate as formatDateUtil,
    formatDateShort as formatDateShortUtil,
    formatDateTime as formatDateTimeUtil,
    formatRelativeDate as formatRelativeDateUtil,
    parseDate as parseDateUtil,
    formatNumber as formatNumberUtil,
    type CurrencyCode,
    type DateFormatType,
} from '@/lib/formatters';

interface FormattingContextType {
    // Currency formatting
    formatCurrency: (amount: number, options?: { showSymbol?: boolean; decimals?: number }) => string;
    currencySymbol: string;
    currencyCode: CurrencyCode;

    // Date formatting
    formatDate: (date: Date | string | number, options?: { includeTime?: boolean; timeFormat?: '12h' | '24h' }) => string;
    formatDateShort: (date: Date | string | number) => string;
    formatDateTime: (date: Date | string | number, timeFormat?: '12h' | '24h') => string;
    formatRelativeDate: (date: Date | string | number) => string;
    parseDate: (dateStr: string) => Date | null;
    dateFormat: DateFormatType;

    // Number formatting
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;

    // Locale
    locale: string;
}

const FormattingContext = createContext<FormattingContextType | undefined>(undefined);

export const useFormatting = () => {
    const context = useContext(FormattingContext);
    if (context === undefined) {
        throw new Error('useFormatting must be used within a FormattingProvider');
    }
    return context;
};

interface FormattingProviderProps {
    children: React.ReactNode;
}

export const FormattingProvider: React.FC<FormattingProviderProps> = ({ children }) => {
    const { user } = useAuth();

    // Get user preferences or use defaults
    const currencyCode = (user?.preferences?.currency as CurrencyCode) || (user?.profile?.currency as CurrencyCode) || 'INR';
    const dateFormat = (user?.preferences?.dateFormat as DateFormatType) || 'DD/MM/YYYY';
    const locale = user?.preferences?.language || 'en-IN';

    // Currency symbol mapping
    const currencySymbols: Record<CurrencyCode, string> = {
        INR: '₹',
        USD: '$',
        EUR: '€',
        GBP: '£',
        AED: 'د.إ',
    };

    const currencySymbol = currencySymbols[currencyCode];

    // Memoized formatting functions
    const formatCurrency = useCallback(
        (amount: number, options?: { showSymbol?: boolean; decimals?: number }) => {
            return formatCurrencyUtil(amount, currencyCode, options);
        },
        [currencyCode]
    );

    const formatDate = useCallback(
        (date: Date | string | number, options?: { includeTime?: boolean; timeFormat?: '12h' | '24h' }) => {
            return formatDateUtil(date, dateFormat, options);
        },
        [dateFormat]
    );

    const formatDateShort = useCallback(
        (date: Date | string | number) => {
            return formatDateShortUtil(date, dateFormat);
        },
        [dateFormat]
    );

    const formatDateTime = useCallback(
        (date: Date | string | number, timeFormat: '12h' | '24h' = '12h') => {
            return formatDateTimeUtil(date, dateFormat, timeFormat);
        },
        [dateFormat]
    );

    const formatRelativeDate = useCallback(
        (date: Date | string | number) => {
            return formatRelativeDateUtil(date);
        },
        []
    );

    const parseDate = useCallback(
        (dateStr: string) => {
            return parseDateUtil(dateStr, dateFormat);
        },
        [dateFormat]
    );

    const formatNumber = useCallback(
        (value: number, options?: Intl.NumberFormatOptions) => {
            return formatNumberUtil(value, locale, options);
        },
        [locale]
    );

    const value: FormattingContextType = {
        formatCurrency,
        currencySymbol,
        currencyCode,
        formatDate,
        formatDateShort,
        formatDateTime,
        formatRelativeDate,
        parseDate,
        dateFormat,
        formatNumber,
        locale,
    };

    return (
        <FormattingContext.Provider value={value}>
            {children}
        </FormattingContext.Provider>
    );
};
