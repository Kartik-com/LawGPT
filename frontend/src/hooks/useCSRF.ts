/**
 * useCSRF — Automatically fetches and attaches the CSRF token
 * to all mutating fetch/axios requests.
 *
 * Usage:
 *   const { csrfToken, fetchWithCSRF } = useCSRF();
 *   fetchWithCSRF('/api/v1/cases', { method: 'POST', body: JSON.stringify(data) });
 */

import { useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/** Read csrf-token cookie value (it's non-httpOnly so JS can access it) */
function getCsrfCookie(): string | null {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`));
    return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function useCSRF() {
    const tokenRef = useRef<string | null>(getCsrfCookie());

    // Fetch a fresh CSRF token from the server if we don't have one yet
    useEffect(() => {
        if (tokenRef.current) return;

        fetch(getApiUrl('/api/v1/auth/csrf-token'), {
            method: 'GET',
            credentials: 'include',
        })
            .then(res => res.json())
            .then(data => {
                if (data.csrfToken) {
                    tokenRef.current = data.csrfToken;
                }
            })
            .catch(() => {
                // CSRF token fetch failed — mutating requests will fail with 403
                // until a page reload sets the cookie
            });
    }, []);

    /**
     * Drop-in replacement for fetch() that automatically adds the CSRF header
     * on mutating requests.
     */
    const fetchWithCSRF = useCallback(
        (url: string, options: RequestInit = {}): Promise<Response> => {
            const method = (options.method || 'GET').toUpperCase();
            const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

            const token = tokenRef.current ?? getCsrfCookie();

            const headers = new Headers(options.headers);
            if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
                headers.set('Content-Type', 'application/json');
            }
            if (isMutating && token) {
                headers.set(CSRF_HEADER_NAME, token);
            }

            return fetch(url, {
                ...options,
                headers,
                credentials: 'include',
            });
        },
        []
    );

    return {
        csrfToken: tokenRef.current,
        fetchWithCSRF,
    };
}
