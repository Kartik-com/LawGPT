/**
 * API utility functions for making requests to the backend
 */

/**
 * Get the API base URL
 * In development: uses Vite proxy (relative path)
 * In production: uses VITE_API_URL environment variable
 */
export function getApiUrl(path: string = ''): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // In production, use VITE_API_URL if set
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl) {
    // Remove trailing slash from API URL if present
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return `${baseUrl}${cleanPath}`;
  }
  
  // In development, use relative path (Vite proxy will handle it)
  // In production without VITE_API_URL, also use relative path (for same-domain deployment)
  return cleanPath;
}

/**
 * Make a fetch request with proper error handling
 */
export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(path);
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Always include credentials for cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

