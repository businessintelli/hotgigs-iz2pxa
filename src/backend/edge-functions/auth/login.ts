import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { rateLimit } from '@upstash/ratelimit'; // ^1.0.0
import { LoginCredentials, AuthToken } from '../../types/auth';
import { validateInput, sanitizeInput } from '../../utils/validation';
import { handleError } from '../../utils/error-handler';
import { comparePassword, generateJWT } from '../../utils/security';
import { logger } from '../../utils/logger';
import { ErrorCode } from '../../types/common';
import { JWT_CONFIG, RATE_LIMIT_CONFIG, SECURITY_HEADERS } from '../../config/security';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize rate limiter
const loginRateLimiter = rateLimit({
  ...RATE_LIMIT_CONFIG.auth,
  prefix: 'login_ratelimit'
});

// Login request validation schema
const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .transform(val => val.toLowerCase()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long'), // bcrypt max length
  device_id: z.string()
    .uuid('Invalid device ID')
    .optional(),
  remember_me: z.boolean()
    .optional()
    .default(false)
});

/**
 * Secure login handler with comprehensive security features
 * @param req - Login request
 * @returns Promise<Response> - Authentication response
 */
export async function login(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip');

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.BAD_REQUEST,
            message: 'Method not allowed'
          }
        }),
        { 
          status: 405,
          headers: {
            ...SECURITY_HEADERS,
            'Allow': 'POST'
          }
        }
      );
    }

    // Rate limiting check
    const rateLimitResult = await loginRateLimiter.limit(`${clientIp}`);
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded', { 
        requestId,
        clientIp,
        remainingTime: rateLimitResult.reset
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'Too many login attempts, please try again later',
            details: {
              retryAfter: rateLimitResult.reset
            }
          }
        }),
        { 
          status: 429,
          headers: {
            ...SECURITY_HEADERS,
            'Retry-After': rateLimitResult.reset.toString()
          }
        }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const credentials = await validateInput<typeof loginSchema>(
      loginSchema,
      rawBody
    ) as LoginCredentials;

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(credentials.email);

    // Query user from database
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('id, email, password, role, failed_login_attempts, account_locked')
      .eq('email', sanitizedEmail)
      .single();

    if (dbError || !user) {
      logger.info('Login failed - User not found', {
        requestId,
        email: sanitizedEmail
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid email or password'
          }
        }),
        { 
          status: 401,
          headers: SECURITY_HEADERS
        }
      );
    }

    // Check account lockout
    if (user.account_locked) {
      logger.warn('Login attempt on locked account', {
        requestId,
        userId: user.id
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Account is locked. Please contact support.'
          }
        }),
        { 
          status: 401,
          headers: SECURITY_HEADERS
        }
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      credentials.password,
      user.password
    );

    if (!isPasswordValid) {
      // Increment failed login attempts
      const newAttempts = user.failed_login_attempts + 1;
      const shouldLock = newAttempts >= 5;

      await supabase
        .from('users')
        .update({
          failed_login_attempts: newAttempts,
          account_locked: shouldLock
        })
        .eq('id', user.id);

      logger.warn('Login failed - Invalid password', {
        requestId,
        userId: user.id,
        attempts: newAttempts
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'Invalid email or password'
          }
        }),
        { 
          status: 401,
          headers: SECURITY_HEADERS
        }
      );
    }

    // Generate JWT tokens
    const tokenExpiry = credentials.remember_me ? 
      JWT_CONFIG.maxAge * 7 : // 7 days
      JWT_CONFIG.maxAge;      // 1 hour

    const accessToken = await generateJWT({
      sub: user.id,
      email: user.email,
      role: user.role,
      device_id: credentials.device_id,
      scope: ['auth']
    });

    const refreshToken = await generateJWT({
      sub: user.id,
      type: 'refresh',
      device_id: credentials.device_id
    });

    // Reset failed login attempts and update last login
    await supabase
      .from('users')
      .update({
        failed_login_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    // Log successful login
    logger.info('Login successful', {
      requestId,
      userId: user.id,
      deviceId: credentials.device_id
    });

    const authToken: AuthToken = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: tokenExpiry,
      token_type: 'Bearer',
      scope: 'auth',
      jti: crypto.randomUUID(),
      device_id: credentials.device_id || 'unknown'
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: authToken
      }),
      { 
        status: 200,
        headers: {
          ...SECURITY_HEADERS,
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    logger.error('Login error', {
      requestId,
      error
    });

    const errorResponse = handleError(error);
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: errorResponse.error.code === ErrorCode.VALIDATION_ERROR ? 400 : 500,
        headers: SECURITY_HEADERS
      }
    );
  }
}