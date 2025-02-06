import { describe, beforeEach, test, expect, jest } from 'jest'; // ^29.0.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { UserRole } from '../../types/auth';
import { mockUsers } from '../mocks/data';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Constants for testing
const TEST_JWT_SECRET = 'test_jwt_secret_for_secure_testing';
const TEST_JWT_EXPIRY = 3600; // 1 hour in seconds
const TEST_DEVICE_ID = 'test-device-123';
const TEST_IP_ADDRESS = '127.0.0.1';

describe('Authentication Tests', () => {
  // Mock Supabase client and auth service
  let mockSupabaseClient: jest.Mocked<typeof createClient>;
  let mockAuthService: jest.Mocked<any>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Initialize mock Supabase client
    mockSupabaseClient = {
      auth: {
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        onAuthStateChange: jest.fn()
      },
      rpc: jest.fn()
    } as any;

    // Initialize mock auth service
    mockAuthService = {
      validateToken: jest.fn(),
      createSession: jest.fn(),
      revokeSession: jest.fn(),
      validateSecurityContext: jest.fn()
    };

    // Configure rate limiting mock
    jest.spyOn(global, 'setTimeout');
  });

  test('successful login with valid credentials', async () => {
    // Arrange
    const { email, password } = {
      email: mockUsers.recruiterUser.email,
      password: 'ValidP@ssw0rd'
    };

    const mockAuthResponse = {
      data: {
        session: {
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: TEST_JWT_EXPIRY,
          user: mockUsers.recruiterUser
        }
      },
      error: null
    };

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);
    mockAuthService.validateSecurityContext.mockResolvedValue(true);

    // Act
    const response = await mockSupabaseClient.auth.signInWithPassword({
      email,
      password,
      options: {
        deviceId: TEST_DEVICE_ID,
        captchaToken: 'valid_captcha'
      }
    });

    // Assert
    expect(response.error).toBeNull();
    expect(response.data.session).toBeDefined();
    expect(response.data.session.access_token).toBeDefined();
    expect(mockAuthService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUsers.recruiterUser.id,
        device_id: TEST_DEVICE_ID,
        ip_address: TEST_IP_ADDRESS
      })
    );
  });

  test('login failure with invalid credentials', async () => {
    // Arrange
    const { email, password } = {
      email: 'invalid@hotgigs.io',
      password: 'WrongP@ssw0rd'
    };

    const mockAuthResponse = {
      data: { session: null },
      error: {
        message: 'Invalid login credentials',
        status: 401
      }
    };

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);

    // Act
    const response = await mockSupabaseClient.auth.signInWithPassword({
      email,
      password,
      options: {
        deviceId: TEST_DEVICE_ID
      }
    });

    // Assert
    expect(response.error).toBeDefined();
    expect(response.data.session).toBeNull();
    expect(mockAuthService.createSession).not.toHaveBeenCalled();
  });

  test('login blocked after multiple failed attempts', async () => {
    // Arrange
    const { email, password } = {
      email: mockUsers.recruiterUser.email,
      password: 'WrongP@ssw0rd'
    };

    // Simulate 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await mockSupabaseClient.auth.signInWithPassword({
        email,
        password,
        options: { deviceId: TEST_DEVICE_ID }
      });
    }

    // Act
    const response = await mockSupabaseClient.auth.signInWithPassword({
      email,
      password,
      options: { deviceId: TEST_DEVICE_ID }
    });

    // Assert
    expect(response.error).toBeDefined();
    expect(response.error?.message).toContain('Account temporarily locked');
    expect(mockAuthService.createSession).not.toHaveBeenCalled();
  });

  test('token refresh with valid refresh token', async () => {
    // Arrange
    const mockRefreshResponse = {
      data: {
        session: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: TEST_JWT_EXPIRY
        }
      },
      error: null
    };

    mockSupabaseClient.auth.refreshSession.mockResolvedValue(mockRefreshResponse);

    // Act
    const response = await mockSupabaseClient.auth.refreshSession({
      refresh_token: 'valid_refresh_token'
    });

    // Assert
    expect(response.error).toBeNull();
    expect(response.data.session.access_token).toBe('new_access_token');
    expect(mockAuthService.validateToken).toHaveBeenCalled();
  });

  test('security headers validation', async () => {
    // Arrange
    const mockHeaders = {
      'user-agent': 'test-browser',
      'x-real-ip': TEST_IP_ADDRESS,
      'x-forwarded-for': TEST_IP_ADDRESS
    };

    // Act
    const validationResult = await mockAuthService.validateSecurityContext({
      headers: mockHeaders,
      deviceId: TEST_DEVICE_ID
    });

    // Assert
    expect(validationResult).toBe(true);
    expect(mockAuthService.validateSecurityContext).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: mockHeaders,
        deviceId: TEST_DEVICE_ID
      })
    );
  });

  test('session management and timeout', async () => {
    // Arrange
    const mockSession = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: TEST_JWT_EXPIRY
    };

    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    // Act
    const response = await mockSupabaseClient.auth.getSession();

    // Assert
    expect(response.data.session).toBeDefined();
    expect(response.data.session.expires_in).toBe(TEST_JWT_EXPIRY);
    
    // Fast-forward time to simulate session timeout
    jest.advanceTimersByTime(TEST_JWT_EXPIRY * 1000 + 1000);
    
    const expiredSession = await mockSupabaseClient.auth.getSession();
    expect(expiredSession.data.session).toBeNull();
  });

  test('role-based authentication for admin access', async () => {
    // Arrange
    const mockAdminResponse = {
      data: {
        session: {
          access_token: 'admin_token',
          user: mockUsers.adminUser
        }
      },
      error: null
    };

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockAdminResponse);

    // Act
    const response = await mockSupabaseClient.auth.signInWithPassword({
      email: mockUsers.adminUser.email,
      password: 'AdminP@ss123',
      options: { deviceId: TEST_DEVICE_ID }
    });

    // Assert
    expect(response.data.session.user.role).toBe(UserRole.ADMIN);
    expect(mockAuthService.validateSecurityContext).toHaveBeenCalled();
  });

  test('concurrent session handling', async () => {
    // Arrange
    const mockConcurrentSessions = [
      { device_id: 'device-1', is_active: true },
      { device_id: 'device-2', is_active: true }
    ];

    mockAuthService.createSession.mockImplementation(async (sessionData) => {
      if (mockConcurrentSessions.length >= 2) {
        throw new Error('Maximum concurrent sessions reached');
      }
      mockConcurrentSessions.push(sessionData);
    });

    // Act & Assert
    const loginAttempt = mockSupabaseClient.auth.signInWithPassword({
      email: mockUsers.recruiterUser.email,
      password: 'ValidP@ss123',
      options: { deviceId: 'device-3' }
    });

    await expect(loginAttempt).rejects.toThrow('Maximum concurrent sessions reached');
  });
});