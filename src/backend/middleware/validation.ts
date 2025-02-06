import { z } from 'zod'; // ^3.22.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { escape } from 'html-escaper'; // ^3.0.3
import { AppError } from '../utils/error-handler';
import { ErrorCode } from '../types/common';
import { Logger } from '../utils/logger';

// Initialize logger instance for validation middleware
const logger = new Logger({ name: 'validation-middleware' });

/**
 * Enum for specifying which part of the request to validate
 */
export enum ValidationTarget {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params'
}

/**
 * Interface for validation middleware options
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  maxPayloadSize?: number;
  sanitizeOptions?: SanitizeOptions;
}

/**
 * Interface for data sanitization options
 */
export interface SanitizeOptions {
  escapeHTML?: boolean;
  trimStrings?: boolean;
  allowedTags?: string[];
  customSanitizer?: (value: any) => any;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: ValidationOptions = {
  stripUnknown: true,
  abortEarly: false,
  maxPayloadSize: 1024 * 1024, // 1MB
  sanitizeOptions: {
    escapeHTML: true,
    trimStrings: true,
    allowedTags: []
  }
};

/**
 * Recursively sanitizes input data to prevent XSS and injection attacks
 */
export function sanitizeData(
  data: Record<string, any>,
  options: SanitizeOptions = DEFAULT_OPTIONS.sanitizeOptions!
): Record<string, any> {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized: Record<string, any> = Array.isArray(data) ? [] : {};
  const seen = new WeakSet();

  function sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      let sanitizedString = value;
      
      if (options.trimStrings) {
        sanitizedString = sanitizedString.trim();
      }
      
      if (options.escapeHTML) {
        sanitizedString = escape(sanitizedString);
      }

      if (options.customSanitizer) {
        sanitizedString = options.customSanitizer(sanitizedString);
      }

      return sanitizedString;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
      return sanitizeData(value, options);
    }

    return value;
  }

  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitizeValue(value);
  }

  return sanitized;
}

/**
 * Creates a validation middleware for request data with performance optimization
 */
export function validateRequest(
  schema: z.ZodSchema,
  target: ValidationTarget = ValidationTarget.BODY,
  options: ValidationOptions = DEFAULT_OPTIONS
) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check payload size
      const payloadSize = Buffer.byteLength(JSON.stringify(req[target]), 'utf8');
      if (payloadSize > mergedOptions.maxPayloadSize!) {
        throw new AppError(
          'Payload size exceeds maximum allowed limit',
          ErrorCode.BAD_REQUEST,
          { size: payloadSize, maxSize: mergedOptions.maxPayloadSize }
        );
      }

      // Extract target data
      const data = req[target];

      // Log validation attempt
      logger.debug('Validating request data', {
        target,
        path: req.path,
        method: req.method
      });

      // Sanitize input data
      const sanitizedData = sanitizeData(data, mergedOptions.sanitizeOptions);

      // Validate sanitized data
      const validatedData = await schema.parseAsync(sanitizedData, {
        strict: !mergedOptions.stripUnknown,
        errorMap: (error, ctx) => ({
          message: ctx.defaultError,
          path: error.path,
          code: 'validation_error'
        })
      });

      // Store validated data back in request
      req[target] = validatedData;

      // Log successful validation
      logger.debug('Request validation successful', {
        target,
        path: req.path
      });

      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const validationError = new AppError(
          'Request validation failed',
          ErrorCode.VALIDATION_ERROR,
          {
            errors: error.errors,
            target,
            path: req.path
          }
        );

        // Log validation failure
        logger.error(validationError, {
          target,
          path: req.path,
          errors: error.errors
        });

        return next(validationError);
      }

      // Handle other errors
      logger.error(error as Error, {
        target,
        path: req.path,
        context: 'validation_middleware'
      });

      return next(error);
    }
  };
}