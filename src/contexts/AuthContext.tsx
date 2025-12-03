import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getApiUrl } from '@/lib/api';

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
  barNumber?: string;
  firm?: string;
  phone?: string;
  address?: string;
  bio?: string;
  emailVerified?: boolean;
  notifications?: NotificationSettings;
  preferences?: PreferenceSettings;
  security?: SecuritySettings;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
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

  const persistUser = useCallback((userData: User | null) => {
    if (userData) {
      setUser(userData);
      localStorage.setItem('legal_pro_user', JSON.stringify(userData));
    } else {
      setUser(null);
      localStorage.removeItem('legal_pro_user');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/auth/me'), { credentials: 'include' });
      if (!res.ok) {
        persistUser(null);
        return;
      }
      const data = await res.json();
      persistUser(data.user as User);
    } catch (error) {
      console.error('Auth refresh failed:', error);
      persistUser(null);
    }
  }, [persistUser]);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        persistUser(null);
        setIsLoading(false);
        return false;
      }
      const data = await res.json();
      persistUser(data.user as User);
      setIsLoading(false);
      return true;
    } catch (error) {
      persistUser(null);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      const data = await res.json();

      if (!res.ok) {
        persistUser(null);
        setIsLoading(false);
        return { success: false, error: data.error || 'Registration failed' };
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
    try {
      await fetch(getApiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Always clear local state regardless of server response
      persistUser(null);
      // Clear cookies manually
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Force reload to clear any cached state
      window.location.href = '/login';
    }
  };

  const verifyEmail = async (token: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
      const res = await fetch(getApiUrl('/api/auth/verify-email'), {
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
      const res = await fetch(getApiUrl('/api/auth/resend-verification'), {
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