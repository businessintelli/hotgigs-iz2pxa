import { z } from 'zod'; // ^3.22.0
import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { validateInput } from '../../utils/validation';
import { AppError } from '../../utils/error-handler';
import { AuthErrorCode } from '../../types/auth';
import { ErrorCode } from '../../types/common';
import { logger } from '../../utils/logger';

// Constants for rate limiting and security
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const BCRYPT_WORK_FACTOR = 12;
const TOKEN_EXPIRY = 3600; // 1 hour in seconds

// Schema for password reset validation
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(64),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    'Password must contain uppercase, lowercase, number, and special character'
  )
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Verifies the validity and expiration of a password reset token
 */
async function verifyResetToken(token: string): Promise<boolean> {
  try {
    const { data: resetToken, error } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !resetToken) {
      throw new AppError('Invalid reset token', AuthErrorCode.TOKEN_INVALID);
    }

    if (resetToken.used) {
      throw new AppError('Token already used', AuthErrorCode.TOKEN_INVALID);
    }

    const tokenExpiry = new Date(resetToken.created_at);
    tokenExpiry.setSeconds(tokenExpiry.getSeconds() + TOKEN_EXPIRY);

    if (new Date() > tokenExpiry) {
      throw new AppError('Token expired', AuthErrorCode.TOKEN_EXPIRED);
    }

    return true;
  } catch (error) {
    logger.error('Token verification failed', { error });
    return false;
  }
}

/**
 * Implements rate limiting for password reset attempts
 */
async function checkRateLimit(ipAddress: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('password_reset_attempts')
      .select('*', { count: 'exact' })
      .eq('ip_address', ipAddress)
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_WINDOW * 1000).toISOString());

    if (count >= RATE_LIMIT_ATTEMPTS) {
      throw new AppError(
        'Too many reset attempts',
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        { retryAfter: RATE_LIMIT_WINDOW }
      );
    }

    await supabase.from('password_reset_attempts').insert({
      ip_address: ipAddress,
      created_at: new Date().toISOString()
    });

    return true;
  } catch (error) {
    logger.error('Rate limit check failed', { error });
    return false;
  }
}

/**
 * Edge function handler for password reset requests
 */
export async function resetPassword(req: Request): Promise<Response> {
  try {
    // Set security headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });

    // Extract client IP
    const clientIp = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    'unknown';

    // Check rate limiting
    await checkRateLimit(clientIp);

    // Parse and validate request body
    const body = await req.json();
    const validatedData = await validateInput(resetPasswordSchema, body);

    // Verify reset token
    const isValidToken = await verifyResetToken(validatedData.token);
    if (!isValidToken) {
      throw new AppError('Invalid or expired token', AuthErrorCode.TOKEN_INVALID);
    }

    // Get user associated with token
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('user_id')
      .eq('token', validatedData.token)
      .single();

    if (tokenError || !tokenData) {
      throw new AppError('Token lookup failed', ErrorCode.INTERNAL_ERROR);
    }

    // Update password and invalidate token
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.user_id,
      { password: validatedData.password }
    );

    if (updateError) {
      throw new AppError('Password update failed', ErrorCode.INTERNAL_ERROR);
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', validatedData.token);

    // Invalidate all active sessions for security
    await supabase.auth.admin.signOut(tokenData.user_id);

    // Log successful password reset
    logger.info('Password reset successful', {
      userId: tokenData.user_id,
      ipAddress: clientIp
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successful'
      }),
      { headers, status: 200 }
    );

  } catch (error) {
    logger.error('Password reset failed', { error });

    const statusCode = error instanceof AppError ? 
      (error.code === AuthErrorCode.RATE_LIMIT_EXCEEDED ? 429 : 400) : 
      500;

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: error instanceof AppError ? error.code : ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
        }
      }),
      { headers: new Headers({ 'Content-Type': 'application/json' }), status: statusCode }
    );
  }
}