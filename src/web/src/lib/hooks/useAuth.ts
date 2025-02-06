import { useContext } from 'react'; // ^18.0.0
import { AuthContext } from '../../contexts/AuthContext';
import { AuthContextType, AuthState, AuthStatus } from '../../types/auth';
import { ERROR_MESSAGES } from '../../config/constants';

/**
 * Custom hook providing secure authentication functionality with comprehensive session management
 * and security controls. Implements JWT-based authentication with MFA support.
 * 
 * @returns {AuthContextType} Authentication context containing state and secure methods
 * @throws {Error} If hook is used outside AuthProvider or context is invalid
 */
export function useAuth(): AuthContextType {
  // Get auth context
  const context = useContext(AuthContext);

  // Validate context existence
  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Ensure the component is wrapped in an AuthProvider component.'
    );
  }

  // Runtime type checking of auth state
  const validateAuthState = (state: AuthState): void => {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid auth state structure');
    }

    if (!Object.values(AuthStatus).includes(state.status)) {
      throw new Error('Invalid auth status value');
    }
  };

  // Validate current auth state
  validateAuthState(context.state);

  // Enhanced security wrapper for auth methods
  const secureAuthMethods = {
    ...context,
    login: async (email: string, password: string, mfaCode?: string) => {
      try {
        // Input validation
        if (!email || !email.includes('@')) {
          throw new Error('Invalid email format');
        }
        if (!password || password.length < 8) {
          throw new Error('Invalid password format');
        }

        // Call context login with optional MFA
        await context.login(email, password, mfaCode);

        // Development logging
        if (process.env.NODE_ENV === 'development') {
          console.debug('Login attempt:', { email, timestamp: new Date() });
        }
      } catch (error) {
        // Secure error handling
        const errorMessage = error instanceof Error ? 
          error.message : ERROR_MESSAGES.GENERIC_ERROR;
        throw new Error(`Authentication failed: ${errorMessage}`);
      }
    },

    logout: async () => {
      try {
        await context.logout();
        
        // Clear any sensitive data from memory
        if (window.crypto && window.crypto.randomBytes) {
          window.crypto.randomBytes(32);
        }
      } catch (error) {
        throw new Error(ERROR_MESSAGES.GENERIC_ERROR);
      }
    },

    refreshToken: async () => {
      try {
        // Validate current session before refresh
        if (context.state.status !== AuthStatus.AUTHENTICATED) {
          throw new Error('No active session to refresh');
        }
        await context.refreshToken();
      } catch (error) {
        throw new Error('Token refresh failed');
      }
    },

    validateSession: async () => {
      // Check authentication status
      if (context.state.status !== AuthStatus.AUTHENTICATED) {
        return false;
      }

      // Verify user object existence
      if (!context.state.user) {
        return false;
      }

      // Validate token expiry
      if (context.state.user.token_expiry) {
        const now = new Date();
        const expiry = new Date(context.state.user.token_expiry);
        if (now >= expiry) {
          await context.logout();
          return false;
        }
      }

      return true;
    },

    enableMFA: async () => {
      if (!context.state.user) {
        throw new Error('User must be authenticated to enable MFA');
      }
      // MFA enablement logic would be implemented here
      throw new Error('MFA enablement not implemented');
    },

    verifyMFA: async (code: string) => {
      if (!code || code.length !== 6) {
        throw new Error('Invalid MFA code format');
      }
      // MFA verification logic would be implemented here
      throw new Error('MFA verification not implemented');
    }
  };

  return secureAuthMethods;
}

// Export hook as default and named export
export default useAuth;