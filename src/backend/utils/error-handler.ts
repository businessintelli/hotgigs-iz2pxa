import { z } from 'zod'; // ^3.22.0
import { logger } from './logger';
import { ErrorCode } from '../types/common';

/**
 * Custom application error class with enhanced context and tracking capabilities
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly details: Record<string, any>;
  public readonly isOperational: boolean;
  public readonly correlationId: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.isOperational = this.determineIfOperational(code);
    this.correlationId = this.generateCorrelationId();
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
    
    // Log error creation
    logger.error(this, {
      errorType: 'AppError',
      code: this.code,
      correlationId: this.correlationId
    });
  }

  private determineIfOperational(code: ErrorCode): boolean {
    const operationalCodes = [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.NOT_FOUND,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      ErrorCode.BAD_REQUEST
    ];
    return operationalCodes.includes(code);
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Determines if an error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return true;
  }

  // Handle database connection errors
  if (error.name === 'ConnectionError' || error.name === 'TimeoutError') {
    return true;
  }

  // Consider all other errors as programming errors
  return false;
}

/**
 * Formats error into standardized response structure
 */
export function formatError(
  error: Error,
  context: Record<string, any> = {}
): Record<string, any> {
  const baseResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: null,
      correlationId: '',
      timestamp: new Date().toISOString()
    }
  };

  if (error instanceof AppError) {
    baseResponse.error = {
      code: error.code,
      message: error.message,
      details: error.details,
      correlationId: error.correlationId,
      timestamp: error.timestamp.toISOString()
    };
  } else if (error instanceof z.ZodError) {
    baseResponse.error = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation error',
      details: {
        errors: error.errors,
        context
      },
      correlationId: `val_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  // Add stack trace in development environment
  if (process.env.NODE_ENV === 'development') {
    baseResponse.error.details = {
      ...baseResponse.error.details,
      stack: error.stack
    };
  }

  return baseResponse;
}

/**
 * Main error handling utility that processes and formats errors
 */
export function handleError(
  error: Error,
  context: Record<string, any> = {}
): Record<string, any> {
  // Log error with context
  logger.error(error, {
    context,
    isOperational: isOperationalError(error)
  });

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return formatError(
      new AppError('Validation error', ErrorCode.VALIDATION_ERROR, {
        validationErrors: error.errors
      }),
      context
    );
  }

  // Handle known application errors
  if (error instanceof AppError) {
    return formatError(error, context);
  }

  // Handle database errors
  if (error.name === 'DatabaseError') {
    const dbError = new AppError(
      'Database operation failed',
      ErrorCode.SERVICE_UNAVAILABLE,
      { originalError: error.message }
    );
    return formatError(dbError, {
      ...context,
      retryable: true,
      retryAfter: 5000
    });
  }

  // Handle unknown errors
  const unknownError = new AppError(
    'An unexpected error occurred',
    ErrorCode.INTERNAL_ERROR,
    { originalError: error.message }
  );
  
  return formatError(unknownError, {
    ...context,
    retryable: false
  });
}