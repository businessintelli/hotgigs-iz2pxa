import React, { createContext, useCallback, useEffect, useRef, useState } from 'react'; // ^18.0.0
import { AuthError } from '@supabase/supabase-js'; // ^2.38.0
import { supabase } from '../../lib/supabase';
import { AuthState, AuthStatus, User } from '../../types/auth';
import { LOCAL_STORAGE_KEYS, ERROR_MESSAGES } from '../config/constants';

// Maximum login attempts before rate limiting
const MAX_LOGIN_ATTEMPTS = 5;
// Rate limit timeout in milliseconds (5 minutes)
const ATTEMPT_TIMEOUT = 5 * 60 * 1000;

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

// Initial authentication state
const initialState: AuthState = {
  status: AuthStatus.LOADING,
  user: null,
  error: null,
  isLoading: true,
  lastAuthenticated: null,
  attemptCount: 0,
  metadata: {}
};

// Create the auth context with default values
export const AuthContext = createContext<AuthContextType>({
  state: initialState,
  login: async () => {},
  logout: async () => {},
  refreshToken: async () => {}
});

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const loginAttemptsRef = useRef<{ count: number; lastAttempt: number }>({
    count: 0,
    lastAttempt: 0
  });

  // Check rate limiting status
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (now - loginAttemptsRef.current.lastAttempt > ATTEMPT_TIMEOUT) {
      loginAttemptsRef.current = { count: 0, lastAttempt: now };
      return false;
    }
    return loginAttemptsRef.current.count >= MAX_LOGIN_ATTEMPTS;
  }, []);

  // Handle authentication state changes
  const handleAuthStateChange = useCallback(async (event: string, session: any) => {
    try {
      if (event === 'SIGNED_IN') {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        setState(prev => ({
          ...prev,
          status: AuthStatus.AUTHENTICATED,
          user: user as User,
          error: null,
          isLoading: false,
          lastAuthenticated: new Date()
        }));

        // Start token refresh cycle
        scheduleTokenRefresh();
      } else if (event === 'SIGNED_OUT') {
        setState(prev => ({
          ...prev,
          status: AuthStatus.UNAUTHENTICATED,
          user: null,
          error: null,
          isLoading: false,
          lastAuthenticated: null
        }));
      }
    } catch (error) {
      console.error('Auth state change error:', error);
      setState(prev => ({
        ...prev,
        status: AuthStatus.ERROR,
        error: ERROR_MESSAGES.GENERIC_ERROR,
        isLoading: false
      }));
    }
  }, []);

  // Schedule token refresh
  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Token refresh error:', error);
      }
    }, 45 * 60 * 1000); // Refresh 15 minutes before expiry (assuming 1-hour tokens)
  }, []);

  // Token refresh implementation
  const refreshToken = async (): Promise<void> => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (session) {
        scheduleTokenRefresh();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: AuthStatus.TOKEN_EXPIRED,
        error: 'Session expired. Please login again.'
      }));
      await logout();
    }
  };

  // Login implementation
  const login = async (email: string, password: string, mfaCode?: string): Promise<void> => {
    try {
      if (checkRateLimit()) {
        throw new Error(`Too many login attempts. Please try again after ${ATTEMPT_TIMEOUT / 1000 / 60} minutes.`);
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          ...(mfaCode && { mfaCode })
        }
      });

      if (error) throw error;

      // Update login attempts
      loginAttemptsRef.current.count = 0;
      loginAttemptsRef.current.lastAttempt = Date.now();

      // Session will be handled by auth state change listener
    } catch (error) {
      loginAttemptsRef.current.count++;
      loginAttemptsRef.current.lastAttempt = Date.now();

      setState(prev => ({
        ...prev,
        status: AuthStatus.ERROR,
        error: error instanceof AuthError ? error.message : ERROR_MESSAGES.GENERIC_ERROR,
        isLoading: false
      }));
    }
  };

  // Logout implementation
  const logout = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear any sensitive data from local storage
      Object.values(LOCAL_STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      // State will be updated by auth state change listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: AuthStatus.ERROR,
        error: error instanceof AuthError ? error.message : ERROR_MESSAGES.GENERIC_ERROR,
        isLoading: false
      }));
    }
  };

  // Initialize auth state and listeners
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError) throw userError;

          setState(prev => ({
            ...prev,
            status: AuthStatus.AUTHENTICATED,
            user: user as User,
            isLoading: false,
            lastAuthenticated: new Date()
          }));

          scheduleTokenRefresh();
        } else {
          setState(prev => ({
            ...prev,
            status: AuthStatus.UNAUTHENTICATED,
            isLoading: false
          }));
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState(prev => ({
          ...prev,
          status: AuthStatus.ERROR,
          error: ERROR_MESSAGES.GENERIC_ERROR,
          isLoading: false
        }));
      }
    };

    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    initializeAuth();

    // Cleanup
    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [handleAuthStateChange, scheduleTokenRefresh]);

  const contextValue = {
    state,
    login,
    logout,
    refreshToken
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};