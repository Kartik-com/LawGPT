import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getApiUrl } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'lawyer' | 'assistant' | 'admin';
  barNumber?: string;
  firm?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
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

  useEffect(() => {
    // Check authentication status only once on app initialization
    const checkAuthStatus = async () => {
      try {
        // First check if we have a stored user and it's still valid
        const storedUser = localStorage.getItem('legal_pro_user');
        if (storedUser) {
          // Verify the stored user with the server
          const res = await fetch(getApiUrl('/api/auth/me'), { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('legal_pro_user', JSON.stringify(data.user));
          } else {
            // Server says we're not authenticated, clear everything
            setUser(null);
            localStorage.removeItem('legal_pro_user');
            // Clear any existing cookies
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        } else {
          // No stored user, check if server has a valid session
          const res = await fetch(getApiUrl('/api/auth/me'), { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('legal_pro_user', JSON.stringify(data.user));
          } else {
            setUser(null);
            // Clear any existing cookies
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setUser(null);
        localStorage.removeItem('legal_pro_user');
        // Clear any existing cookies
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

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
        setIsLoading(false);
        return false;
      }
      const data = await res.json();
      const newUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        barNumber: data.user.barNumber,
        firm: data.user.firm,
      };
      setUser(newUser);
      localStorage.setItem('legal_pro_user', JSON.stringify(newUser));
      setIsLoading(false);
      return true;
    } catch (error) {
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
        setIsLoading(false);
        return { success: false, error: data.error || 'Registration failed' };
      }
      
      const newUser: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        barNumber: data.user.barNumber,
        firm: data.user.firm,
      };
      
      // Token is automatically set in cookie by backend
      // Store user in localStorage
      setUser(newUser);
      localStorage.setItem('legal_pro_user', JSON.stringify(newUser));
      setIsLoading(false);
      return { success: true };
    } catch (error) {
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
      setUser(null);
      localStorage.removeItem('legal_pro_user');
      // Clear cookies manually
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Force reload to clear any cached state
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};