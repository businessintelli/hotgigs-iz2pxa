import { supabase } from '../supabase';
import { AuthError } from '@supabase/supabase-js'; // ^2.38.0
import { analytics } from '@segment/analytics-next'; // ^1.55.0
import { 
  User, 
  LoginCredentials, 
  RegisterData,
  loginCredentialsSchema,
  registerDataSchema,
  userSchema,
  UserRole
} from '../../types/auth';
import { ErrorCode } from '../../types/common';
import { API_RATE_LIMITS, LOCAL_STORAGE_KEYS } from '../../config/constants';

// Rate limiting configuration
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

/**
 * Rate limiting decorator factory
 */
function rateLimit(limit: number, windowMs: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const key = `${propertyKey}:${args[0]?.email || 'anonymous'}`;
      const now = Date.now();
      const record = rateLimitStore.get(key) || { count: 0, timestamp: now };

      if (now - record.timestamp > windowMs) {
        record.count = 0;
        record.timestamp = now;
      }

      if (record.count >= limit) {
        throw new Error(`Rate limit exceeded. Please try again in ${Math.ceil((windowMs - (now - record.timestamp)) / 1000)} seconds.`);
      }

      record.count++;
      rateLimitStore.set(key, record);

      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

/**
 * Analytics tracking decorator
 */
function trackAuthEvent(eventName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args);
        analytics.track(eventName, {
          success: true,
          timestamp: new Date().toISOString()
        });
        return result;
      } catch (error) {
        analytics.track(eventName, {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };
    return descriptor;
  };
}

/**
 * Validates and enhances user session security
 */
async function validateSession(user: User | null): Promise<void> {
  if (!user) return;

  const { data: session } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Invalid session');
  }

  const tokenExpiry = new Date(session.session?.expires_at || 0);
  if (tokenExpiry < new Date()) {
    throw new Error('Session expired');
  }
}

/**
 * Authenticates user with enhanced security measures
 */
@rateLimit(API_RATE_LIMITS.JOBS.limit, API_RATE_LIMITS.JOBS.window)
@trackAuthEvent('login_attempt')
export async function login(credentials: LoginCredentials): Promise<User> {
  try {
    // Validate credentials format
    const validatedCredentials = loginCredentialsSchema.parse(credentials);

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validatedCredentials.email,
      password: validatedCredentials.password
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Authentication failed');

    // Fetch additional user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) throw userError;

    // Validate and enhance user data
    const user = userSchema.parse({
      ...userData,
      email_verified: authData.user.email_verified,
      last_login: new Date(),
      refresh_token: authData.session?.refresh_token || null,
      token_expiry: authData.session?.expires_at ? new Date(authData.session.expires_at) : null
    });

    // Store session if remember_me is true
    if (credentials.remember_me) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, authData.session?.access_token || '');
    }

    return user;
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof AuthError) {
      throw new Error(error.message);
    }
    throw new Error('Authentication failed. Please try again.');
  }
}

/**
 * Registers new user with enhanced validation
 */
@trackAuthEvent('registration')
export async function register(data: RegisterData): Promise<User> {
  try {
    // Validate registration data
    const validatedData = registerDataSchema.parse(data);

    // Register with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.full_name,
          role: validatedData.role || UserRole.CANDIDATE
        }
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration failed');

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([{
        id: authData.user.id,
        email: validatedData.email,
        full_name: validatedData.full_name,
        role: validatedData.role,
        profile: validatedData.profile || {},
        email_verified: false,
        last_login: new Date()
      }])
      .select()
      .single();

    if (userError) throw userError;

    return userSchema.parse(userData);
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof AuthError) {
      throw new Error(error.message);
    }
    throw new Error('Registration failed. Please try again.');
  }
}

/**
 * Securely logs out user and cleans up session
 */
@trackAuthEvent('logout')
export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error('Logout failed. Please try again.');
  }
}

/**
 * Initiates password reset with rate limiting
 */
@rateLimit(3, 3600000) // 3 requests per hour
@trackAuthEvent('password_reset_request')
export async function resetPassword(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) throw error;
  } catch (error) {
    console.error('Password reset error:', error);
    throw new Error('Password reset failed. Please try again.');
  }
}

/**
 * Retrieves current user with session validation
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) return null;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (userError) throw userError;

    await validateSession(userData);

    return userSchema.parse({
      ...userData,
      email_verified: authUser.email_verified,
      last_login: new Date(authUser.last_sign_in_at || ''),
      refresh_token: null,
      token_expiry: null
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}