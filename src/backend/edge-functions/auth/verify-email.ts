import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { rateLimit } from '@upstash/ratelimit'; // ^1.0.0
import winston from 'winston'; // ^3.11.0
import { User } from '../../types/auth';
import { AppError } from '../../utils/error-handler';
import { validateInput } from '../../utils/validation';
import { ErrorCode } from '../../types/common';

// Constants for token and rate limiting configuration
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_VERIFICATION_ATTEMPTS = 5;
const RATE_LIMIT_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Validation schema for verification request
const verificationSchema = z.object({
  token: z.string().min(32).max(256)
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'email-verification' },
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * Validates verification token format, entropy, and expiration
 */
async function validateToken(token: string): Promise<boolean> {
  try {
    // Check token format and entropy
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
      throw new AppError('Invalid token format', ErrorCode.VALIDATION_ERROR);
    }

    // Verify token in database
    const { data: tokenData, error } = await supabase
      .from('verification_tokens')
      .select('created_at, used')
      .eq('token', token)
      .single();

    if (error || !tokenData) {
      throw new AppError('Invalid verification token', ErrorCode.UNAUTHORIZED);
    }

    // Check if token is already used
    if (tokenData.used) {
      throw new AppError('Token already used', ErrorCode.UNAUTHORIZED);
    }

    // Check token expiration
    const tokenAge = Date.now() - new Date(tokenData.created_at).getTime();
    if (tokenAge > TOKEN_EXPIRY) {
      throw new AppError('Token expired', ErrorCode.UNAUTHORIZED);
    }

    return true;
  } catch (error) {
    logger.error('Token validation failed', { error });
    return false;
  }
}

/**
 * Edge function handler for email verification
 */
export async function verifyEmail(req: Request): Promise<Response> {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new AppError('Method not allowed', ErrorCode.BAD_REQUEST);
    }

    // Parse and validate request body
    const body = await req.json();
    const { token } = await validateInput(verificationSchema, body);

    // Apply rate limiting
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for');
    if (!ip) {
      throw new AppError('Invalid request origin', ErrorCode.BAD_REQUEST);
    }

    const rateLimiter = rateLimit({
      max: RATE_LIMIT_ATTEMPTS,
      windowMs: RATE_LIMIT_WINDOW
    });

    const rateLimitResult = await rateLimiter.check(ip);
    if (!rateLimitResult.success) {
      throw new AppError('Rate limit exceeded', ErrorCode.FORBIDDEN, {
        retryAfter: rateLimitResult.reset
      });
    }

    // Validate token
    const isValidToken = await validateToken(token);
    if (!isValidToken) {
      throw new AppError('Invalid verification token', ErrorCode.UNAUTHORIZED);
    }

    // Begin database transaction
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, email_verified, verification_attempts')
      .eq('verification_token', token)
      .single();

    if (userError || !userData) {
      throw new AppError('User not found', ErrorCode.NOT_FOUND);
    }

    // Check verification attempts
    if (userData.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw new AppError('Maximum verification attempts exceeded', ErrorCode.FORBIDDEN);
    }

    // Update user verification status
    const { error: updateError } = await supabase
      .from('users')
      .update({
        email_verified: true,
        verification_attempts: userData.verification_attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (updateError) {
      throw new AppError('Failed to update user verification status', ErrorCode.INTERNAL_ERROR);
    }

    // Mark token as used
    await supabase
      .from('verification_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', token);

    // Log successful verification
    logger.info('Email verification successful', {
      userId: userData.id,
      email: userData.email
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email verification successful'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    // Handle and log errors
    const errorResponse = error instanceof AppError ? error : new AppError(
      'Email verification failed',
      ErrorCode.INTERNAL_ERROR
    );

    logger.error('Email verification failed', { error });

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: errorResponse.code,
          message: errorResponse.message
        }
      }),
      {
        status: errorResponse.code === ErrorCode.INTERNAL_ERROR ? 500 : 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}