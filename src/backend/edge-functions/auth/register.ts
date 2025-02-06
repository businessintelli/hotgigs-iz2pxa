import { createClient } from '@supabase/supabase-js'; // ^2.0.0
import { z } from 'zod'; // ^3.22.0
import { logger } from '@datadog/browser-logs'; // ^4.0.0
import { rateLimit } from '@vercel/edge-rate-limit'; // ^1.0.0
import { RegisterData, UserRole } from '../../types/auth';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { ErrorCode } from '../../types/common';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Enhanced registration schema with security rules
const registerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .refine(email => email.length <= 255, 'Email too long'),
  
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
    .max(72, 'Password too long'), // bcrypt limitation
  
  full_name: z.string()
    .min(2, 'Name too short')
    .max(100, 'Name too long')
    .trim()
    .refine(name => /^[a-zA-Z\s-']+$/.test(name), 'Invalid characters in name'),
  
  role: z.enum([UserRole.RECRUITER, UserRole.HIRING_MANAGER, UserRole.CANDIDATE])
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  max: 5,
  window: '15m',
  keyGenerator: (req: Request) => 
    `${req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')}-${req.headers.get('user-agent')}`,
  handler: () => new Response(
    JSON.stringify({ 
      error: 'Too many registration attempts. Please try again later.' 
    }),
    { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    }
  )
};

// Security configuration
const SECURITY_CONFIG = {
  passwordHashingRounds: 12,
  emailVerificationExpiry: '24h',
  maxLoginAttempts: 5,
  lockoutDuration: '1h'
};

/**
 * Handles secure user registration with comprehensive validation and monitoring
 */
export const register = rateLimit(RATE_LIMIT_CONFIG)(async (req: Request): Promise<Response> => {
  try {
    // Initialize monitoring context
    const requestId = crypto.randomUUID();
    logger.addLoggerGlobalContext({ requestId });

    // Validate request method
    if (req.method !== 'POST') {
      throw new AppError('Method not allowed', ErrorCode.BAD_REQUEST);
    }

    // Parse and validate request body
    const rawData = await req.json();
    const registrationData = await validateInput(registerSchema, rawData);

    // Sanitize inputs
    const sanitizedData: RegisterData = {
      email: sanitizeInput(registrationData.email),
      password: registrationData.password, // Don't sanitize password
      full_name: sanitizeInput(registrationData.full_name),
      role: registrationData.role
    };

    // Check for existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .ilike('email', sanitizedData.email)
      .single();

    if (existingUser) {
      throw new AppError('Email already registered', ErrorCode.CONFLICT);
    }

    // Create user with secure defaults
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: sanitizedData.email,
      password: sanitizedData.password,
      email_confirm: false,
      user_metadata: {
        full_name: sanitizedData.full_name,
        role: sanitizedData.role
      }
    });

    if (createError) {
      logger.error('User creation failed', {
        error: createError,
        requestId
      });
      throw new AppError('Registration failed', ErrorCode.INTERNAL_ERROR);
    }

    // Create user profile with RLS policies
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        email: sanitizedData.email,
        full_name: sanitizedData.full_name,
        role: sanitizedData.role,
        email_verified: false,
        failed_login_attempts: 0,
        account_locked: false,
        security_questions: [],
        allowed_ip_addresses: [],
        profile: {
          preferences: {},
          notification_settings: {
            email: true,
            push: false
          }
        }
      });

    if (profileError) {
      // Rollback user creation if profile creation fails
      await supabase.auth.admin.deleteUser(user.id);
      throw new AppError('Profile creation failed', ErrorCode.INTERNAL_ERROR);
    }

    // Log successful registration
    logger.info('User registered successfully', {
      userId: user.id,
      role: sanitizedData.role,
      requestId
    });

    // Return success response with filtered user data
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: user.id,
          email: sanitizedData.email,
          full_name: sanitizedData.full_name,
          role: sanitizedData.role
        }
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId
        }
      }
    );

  } catch (error) {
    // Log error with context
    logger.error('Registration error', {
      error,
      requestId: logger.getLoggerGlobalContext().requestId
    });

    // Format error response
    const errorResponse = error instanceof AppError ? error : new AppError(
      'Registration failed',
      ErrorCode.INTERNAL_ERROR
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: errorResponse.code,
          message: errorResponse.message,
          details: process.env.NODE_ENV === 'development' ? errorResponse.details : undefined
        }
      }),
      {
        status: errorResponse.code === ErrorCode.INTERNAL_ERROR ? 500 : 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});