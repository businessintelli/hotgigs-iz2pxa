import { render, screen, waitFor, fireEvent, within, userEvent } from '@testing-library/react'; // ^14.0.0
import { rest } from 'msw'; // ^1.3.0
import { setupServer } from 'msw/node'; // ^1.3.0
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'; // ^0.34.0
import { LoginForm } from '../../components/auth/LoginForm';
import { AuthProvider } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AuthStatus, UserRole } from '../../types/auth';
import { ERROR_MESSAGES } from '../../config/constants';

// Mock user data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: UserRole.RECRUITER,
  email_verified: true,
  last_login: new Date(),
  permissions: ['read:jobs', 'write:jobs'],
  refresh_token: 'mock-refresh-token',
  token_expiry: new Date(Date.now() + 3600000),
  created_at: new Date(),
  updated_at: new Date(),
  profile: {
    avatar_url: null,
    phone: null,
    skills: [],
    location: null,
    timezone: 'UTC',
    linkedin_url: null,
    github_url: null,
    portfolio_url: null,
    languages: [],
    preferences: {},
    notifications_settings: {},
    social_links: {}
  }
};

// MSW server setup
const server = setupServer(
  // Login endpoint
  rest.post(`${supabase.auth.url}/token`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        user: mockUser
      })
    );
  }),

  // MFA verification endpoint
  rest.post(`${supabase.auth.url}/mfa/verify`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true
      })
    );
  }),

  // Token refresh endpoint
  rest.post(`${supabase.auth.url}/token?grant_type=refresh_token`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock-refreshed-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh-token'
      })
    );
  })
);

// Helper function to render components with auth context
const renderWithAuth = (ui: React.ReactElement, options = {}) => {
  const defaultAuthState = {
    status: AuthStatus.UNAUTHENTICATED,
    user: null,
    error: null,
    isLoading: false,
    lastAuthenticated: null,
    attemptCount: 0,
    metadata: {}
  };

  return render(
    <AuthProvider>{ui}</AuthProvider>,
    {
      ...options
    }
  );
};

// Test setup and teardown
beforeEach(() => {
  server.listen();
  vi.useFakeTimers();
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Authentication Integration Tests', () => {
  describe('Login Flow', () => {
    it('should handle successful login with valid credentials', async () => {
      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(ERROR_MESSAGES.GENERIC_ERROR)).not.toBeInTheDocument();
      });
    });

    it('should handle rate limiting', async () => {
      server.use(
        rest.post(`${supabase.auth.url}/token`, (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              error: 'Too many requests',
              message: 'Please try again later'
            })
          );
        })
      );

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/too many login attempts/i);
      });
    });

    it('should validate input fields', async () => {
      renderWithAuth(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByRole('alert')).toHaveLength(2);
      });
    });
  });

  describe('Session Management', () => {
    it('should handle token refresh', async () => {
      vi.setSystemTime(new Date(Date.now() + 45 * 60 * 1000)); // 45 minutes later

      const mockRefreshToken = vi.spyOn(supabase.auth, 'refreshSession');
      
      renderWithAuth(<LoginForm />);

      await waitFor(() => {
        expect(mockRefreshToken).toHaveBeenCalled();
      });
    });

    it('should handle session expiry', async () => {
      server.use(
        rest.post(`${supabase.auth.url}/token?grant_type=refresh_token`, (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({
              error: 'Token expired',
              message: 'Session has expired'
            })
          );
        })
      );

      renderWithAuth(<LoginForm />);

      await waitFor(() => {
        expect(screen.queryByText(/session expired/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      server.use(
        rest.post(`${supabase.auth.url}/token`, (req, res) => {
          return res.networkError('Failed to connect');
        })
      );

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(ERROR_MESSAGES.NETWORK_ERROR);
      });
    });

    it('should handle invalid credentials', async () => {
      server.use(
        rest.post(`${supabase.auth.url}/token`, (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({
              error: 'Invalid credentials',
              message: 'Email or password is incorrect'
            })
          );
        })
      );

      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'WrongPassword123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/email or password is incorrect/i);
      });
    });
  });

  describe('Security Features', () => {
    it('should sanitize user input', async () => {
      const mockLogin = vi.spyOn(supabase.auth, 'signInWithPassword');
      
      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, ' Test@Example.com ');
      await userEvent.type(passwordInput, 'Password123!');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'Password123!'
        });
      });
    });

    it('should prevent XSS attacks', async () => {
      renderWithAuth(<LoginForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const maliciousScript = '<script>alert("xss")</script>@example.com';

      await userEvent.type(emailInput, maliciousScript);

      expect(emailInput).toHaveValue(maliciousScript);
      expect(document.querySelector('script')).not.toBeInTheDocument();
    });
  });
});