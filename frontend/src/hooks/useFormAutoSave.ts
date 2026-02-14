import { useEffect, useRef, useCallback } from 'react';

interface UseFormAutoSaveOptions {
    debounceMs?: number;
    enabled?: boolean;
}

/**
 * Custom hook for auto-saving form data to localStorage
 * 
 * @param formKey - Unique identifier for the form (e.g., 'case-form', 'client-form')
 * @param formData - Current form state to be saved
 * @param options - Configuration options
 * @returns Object with clearSavedData function
 * 
 * @example
 * const { clearSavedData } = useFormAutoSave('case-form', formData, { debounceMs: 500 });
 * // Clear saved data after successful submission
 * clearSavedData();
 */
export function useFormAutoSave<T extends Record<string, any>>(
    formKey: string,
    formData: T,
    options: UseFormAutoSaveOptions = {}
) {
    const { debounceMs = 500, enabled = true } = options;
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const storageKey = `lawgpt_form_draft_${formKey}`;

    // Save form data to localStorage with debouncing
    useEffect(() => {
        if (!enabled) return;

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout to save data
        timeoutRef.current = setTimeout(() => {
            try {
                // Only save if there's actual data (not all empty strings)
                const hasData = Object.values(formData).some(value => {
                    if (typeof value === 'string') return value.trim() !== '';
                    if (Array.isArray(value)) return value.length > 0;
                    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
                    return value !== null && value !== undefined;
                });

                if (hasData) {
                    localStorage.setItem(storageKey, JSON.stringify({
                        data: formData,
                        timestamp: Date.now()
                    }));
                }
            } catch (error) {
                console.error('Failed to save form data:', error);
            }
        }, debounceMs);

        // Cleanup timeout on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [formData, storageKey, debounceMs, enabled]);

    // Clear saved data from localStorage
    const clearSavedData = useCallback(() => {
        try {
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error('Failed to clear saved form data:', error);
        }
    }, [storageKey]);

    // Get saved data from localStorage
    const getSavedData = useCallback((): T | null => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.data as T;
            }
        } catch (error) {
            console.error('Failed to retrieve saved form data:', error);
        }
        return null;
    }, [storageKey]);

    return {
        clearSavedData,
        getSavedData
    };
}
