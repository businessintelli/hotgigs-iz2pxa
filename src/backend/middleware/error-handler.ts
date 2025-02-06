import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { DataDog } from 'datadog-metrics'; // ^0.9.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { logger } from '../utils/logger';
import { handleError, isOperationalError } from '../utils/error-handler';
import { ErrorCode } from '../types/common';

// Initialize DataDog metrics
const metrics = new DataDog({
  apiKey: process.env.DD_API_KEY,
  prefix: 'hotgigs.errors.',
  defaultTags: [`env:${process.env.NODE_ENV}`]
});

// Configure circuit breaker for error categories
const circuitBreaker = new CircuitBreaker(
  async (error: Error) => {
    return isOperationalError(error);
  },
  {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  }
);

// Map error types to HTTP status codes
const errorStatusMap = new Map<ErrorCode, number>([
  [ErrorCode.VALIDATION_ERROR, 400],
  [ErrorCode.BAD_REQUEST, 400],
  [ErrorCode.UNAUTHORIZED, 401],
  [ErrorCode.FORBIDDEN, 403],
  [ErrorCode.NOT_FOUND, 404],
  [ErrorCode.CONFLICT, 409],
  [ErrorCode.INTERNAL_ERROR, 500],
  [ErrorCode.SERVICE_UNAVAILABLE, 503]
]);

/**
 * Enhanced error handling middleware with security monitoring and correlation tracking
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Enrich error context with request details
  const errorContext = {
    correlationId,
    path: req.path,
    method: req.method,
    requestId: req.headers['x-request-id'],
    userId: (req as any).user?.id,
    userAgent: req.headers['user-agent'],
    clientIp: req.ip
  };

  try {
    // Check circuit breaker status
    if (!circuitBreaker.opened) {
      // Process error with security context
      const errorResponse = handleError(error, errorContext);

      // Track error metrics
      metrics.increment('total', 1);
      metrics.increment(errorResponse.error.code.toLowerCase(), 1);

      // Determine HTTP status code
      const statusCode = errorStatusMap.get(errorResponse.error.code as ErrorCode) || 500;

      // Set retry headers for certain error types
      if (statusCode === 429 || statusCode === 503) {
        res.set('Retry-After', '60');
      }

      // Log error with security context
      logger.error(error, {
        ...errorContext,
        statusCode,
        errorCode: errorResponse.error.code
      });

      // Send error response
      res.status(statusCode).json(errorResponse);

      // Trigger security monitoring for non-operational errors
      if (!isOperationalError(error)) {
        logger.security('Critical error detected', {
          ...errorContext,
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });

        // Update circuit breaker state
        circuitBreaker.fire(error).catch(() => {
          // Circuit breaker opened - log system degradation
          logger.error('Circuit breaker opened - system degradation detected', errorContext);
        });
      }
    } else {
      // Circuit breaker is open - return service unavailable
      res.status(503).json({
        success: false,
        error: {
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: 'Service temporarily unavailable',
          details: { retryAfter: 60 },
          correlationId
        }
      });
    }
  } catch (handlingError) {
    // Fallback error handling if error processing fails
    logger.error('Error handler failed', {
      originalError: error,
      handlingError,
      context: errorContext
    });

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
        correlationId
      }
    });
  }
};

/**
 * Higher-order function to wrap async route handlers with error catching
 */
export const asyncErrorHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};