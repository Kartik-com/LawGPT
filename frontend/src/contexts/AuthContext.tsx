import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getApiUrl, apiFetch } from '@/lib/api';

interface NotificationSettings {
  emailAlerts: boolean;
  smsAlerts: boolean;
  pushNotifications: boolean;
  hearingReminders: boolean;
  clientUpdates: boolean;
  billingAlerts: boolean;
  weeklyReports: boolean;
}

interface PreferenceSettings {
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: string;
  loginNotifications: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'lawyer' | 'assistant' | 'admin';
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  immutableFieldsLocked?: boolean;
  profile?: {
    fullName?: string | null;
    barCouncilNumber?: string | null;
    currency?: string | null;
    phoneNumber?: string | null;
    lawFirmName?: string | null;
    practiceAreas?: string[];
    courtLevels?: string[];
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    timezone?: string | null;
  };
  notifications?: NotificationSettings;
  preferences?: PreferenceSettings;
  security?: SecuritySettings;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: string;
  barNumber?: string;
  firm?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Guard: prevents refreshUser() from re-authenticating while logout is in progress
  const isLoggingOut = useRef(false);

  const persistUser = useCallback((userData: User | null) => {
    if (userData) {
      setUser(userData);
      // JWT is stored in httpOnly cookie only — no sensitive data in localStorage
    } else {
      setUser(null);
      // Clean up any stale data from previous sessions
      localStorage.removeItem('legal_pro_user');
      // Clear cookies (belt-and-suspenders alongside httpOnly cookie cleared by backend)
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname + ';';
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      if (parts.length > 1) {
        const domain = '.' + parts.slice(-2).join('.');
        document.cookie = `token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`;
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await apiFetch(getApiUrl('/api/v1/auth/me'), {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      clearTimeout(timeoutId);

      if (res.status === 401) {
        // Access token may have expired — attempt silent refresh using the refresh cookie
        // Skip refresh entirely if logout is in progress to prevent re-login after logout
        if (isLoggingOut.current) { persistUser(null); return; }
        try {
          const refreshRes = await apiFetch(getApiUrl('/api/v1/auth/refresh'), {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
          });
          if (!refreshRes.ok) {
            persistUser(null);
            return;
          }
          // Retry /me with the new access token
          const retryRes = await apiFetch(getApiUrl('/api/v1/auth/me'), {
            credentials: 'include',
            cache: 'no-store',
          });
          if (!retryRes.ok) { persistUser(null); return; }
          const retryData = await retryRes.json();
          persistUser(retryData.user ? retryData.user as User : null);
          return;
        } catch {
          persistUser(null);
          return;
        }
      }

      if (!res.ok) { persistUser(null); return; }
      const data = await res.json();
      persistUser(data.user ? data.user as User : null);
    } catch (error: any) {
      if (error.name !== 'AbortError') persistUser(null);
    }
  }, [persistUser]);

  useEffect(() => {
    let mounted = true;
    let visibilityTimeout: NodeJS.Timeout | null = null;
    let focusTimeout: NodeJS.Timeout | null = null;

    const init = async () => {
      try {
        // Always validate session on mount - don't trust localStorage
        await refreshUser();
      } catch (error) {
        // Clear any stale auth data on error
        persistUser(null);
      } finally {
        // Always set loading to false, even if refresh fails
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Set a timeout to ensure loading doesn't hang forever
    const timeout = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 5000); // Max 5 seconds for initial load

    init();

    // Handle browser back/forward cache (bfcache) - always revalidate
    const handlePageShow = (event: PageTransitionEvent) => {
      // Always revalidate auth state when page is shown
      // This prevents stale auth state when using browser back/forward buttons
      if (event.persisted && mounted) {
        refreshUser();
      }
    };

    // Also handle visibility change (tab switching) - debounced
    const handleVisibilityChange = () => {
      if (!document.hidden && mounted) {
        // Debounce to prevent excessive calls
        if (visibilityTimeout) clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(() => {
          if (mounted) {
            refreshUser();
          }
        }, 500);
      }
    };

    // Handle focus events (window regains focus) - debounced
    const handleFocus = () => {
      if (focusTimeout) clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        if (mounted) {
          refreshUser();
        }
      }, 500);
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (visibilityTimeout) clearTimeout(visibilityTimeout);
      if (focusTimeout) clearTimeout(focusTimeout);
    };
  }, [refreshUser, persistUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    setIsLoading(true);
    try {
      // Clear any existing auth state before login
      persistUser(null);

      const res = await apiFetch(getApiUrl('/api/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        persistUser(null);
        setIsLoading(false);
        // Return specific error message and errorCode from backend
        return {
          success: false,
          error: data.error || data.message || 'Login failed',
          errorCode: data.errorCode // Pass through errorCode for deleted account detection
        };
      }

      if (data.user) {
        persistUser(data.user as User);
        setIsLoading(false);
        return { success: true };
      } else {
        persistUser(null);
        setIsLoading(false);
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (error) {
      persistUser(null);
      setIsLoading(false);
      return { success: false, error: 'Network error occurred' };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string; errorCode?: string }> => {
    setIsLoading(true);
    try {
      const res = await apiFetch(getApiUrl('/api/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(userData),
      });

      const data = await res.json();

      if (!res.ok) {
        persistUser(null);
        setIsLoading(false);
        return { success: false, error: data.error || 'Registration failed', errorCode: data.errorCode };
      }

      persistUser(data.user as User);
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      persistUser(null);
      setIsLoading(false);
      return { success: false, error: 'Network error occurred' };
    }
  };

  const logout = async () => {
    // Set guard immediately — prevents any concurrent refreshUser() from re-logging in
    isLoggingOut.current = true;
    try {
      // Clear local state first
      persistUser(null);

      // Attempt server logout
      await apiFetch(getApiUrl('/api/v1/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Always clear local state regardless of server response
      persistUser(null);

      // Clear all cookies manually with all possible configurations
      const hostname = window.location.hostname;
      const cookiesToClear = [
        'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;',
        `token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`,
      ];

      // Try clearing with parent domain if applicable
      const parts = hostname.split('.');
      if (parts.length > 1) {
        const domain = '.' + parts.slice(-2).join('.');
        cookiesToClear.push(`token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain};`);
      }

      cookiesToClear.forEach(cookie => {
        document.cookie = cookie;
      });

      // Clear sessionStorage and localStorage completely
      sessionStorage.clear();
      localStorage.removeItem('legal_pro_user');

      // Use replace instead of href to prevent back button from showing protected pages
      // This removes the current page from browser history
      window.location.replace('/login');
    }
  };

  const verifyEmail = async (token: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await apiFetch(getApiUrl('/api/v1/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Verification failed' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await apiFetch(getApiUrl('/api/v1/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send email' };
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: 'Network error occurred' };
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    refreshUser,
    verifyEmail,
    resendVerificationEmail,
    isLoading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};