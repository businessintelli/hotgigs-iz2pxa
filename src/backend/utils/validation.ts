import { z } from 'zod'; // ^3.22.0
import { AppError } from './error-handler';
import { ErrorCode } from '../types/common';

// Cache configuration constants
const SCHEMA_CACHE_SIZE = 100;
const SCHEMA_CACHE_TTL = 3600; // 1 hour in seconds

// Pagination constants
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE = 1;

// Schema validation cache using Map
const schemaCache = new Map<string, {
  schema: z.ZodSchema;
  timestamp: number;
}>();

/**
 * Generic validation function that validates input data against a Zod schema
 * with enhanced error handling and type inference
 */
export async function validateInput<T extends z.ZodType>(
  schema: T,
  data: unknown
): Promise<z.infer<T>> {
  try {
    // Ensure schema is a valid Zod schema
    if (!(schema instanceof z.ZodType)) {
      throw new AppError(
        'Invalid schema provided',
        ErrorCode.VALIDATION_ERROR,
        { schemaType: typeof schema }
      );
    }

    // Check cache for compiled schema
    const cacheKey = schema.toString();
    const cached = schemaCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < SCHEMA_CACHE_TTL * 1000) {
      return cached.schema.parse(data) as z.infer<T>;
    }

    // Validate data against schema
    const validatedData = await schema.parseAsync(data);

    // Cache the compiled schema
    if (schemaCache.size >= SCHEMA_CACHE_SIZE) {
      // Remove oldest entry if cache is full
      const oldestKey = [...schemaCache.keys()][0];
      schemaCache.delete(oldestKey);
    }
    schemaCache.set(cacheKey, { schema, timestamp: now });

    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(
        'Validation failed',
        ErrorCode.VALIDATION_ERROR,
        {
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        }
      );
    }
    throw error;
  }
}

/**
 * Enhanced input sanitization function with comprehensive XSS and injection protection
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Escape special characters
    .replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }[char] || char))
    // Normalize Unicode characters
    .normalize('NFKC')
    // Remove potential SQL injection patterns
    .replace(/(\b(select|insert|update|delete|drop|union|exec|eval)\b)|(-{2}|;)/gi, '')
    // Remove null bytes and control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates and normalizes pagination parameters with bounds checking
 */
export function validatePaginationParams(params: {
  page?: number | string;
  limit?: number | string;
}): { page: number; limit: number } {
  const parsedPage = Number(params.page);
  const parsedLimit = Number(params.limit);

  const page = !isNaN(parsedPage) && parsedPage >= MIN_PAGE
    ? Math.floor(parsedPage)
    : MIN_PAGE;

  const limit = !isNaN(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return { page, limit };
}

/**
 * Validates sorting parameters with SQL injection prevention
 */
export function validateSortParams(
  params: { field?: string; order?: string },
  allowedFields: string[]
): { field: string; order: 'ASC' | 'DESC' } {
  // Default sort parameters
  const defaultSort = {
    field: allowedFields[0],
    order: 'DESC' as const
  };

  if (!params.field || !params.order) {
    return defaultSort;
  }

  // Sanitize and validate field name
  const sanitizedField = sanitizeInput(params.field);
  if (!allowedFields.includes(sanitizedField)) {
    throw new AppError(
      'Invalid sort field',
      ErrorCode.VALIDATION_ERROR,
      {
        allowedFields,
        providedField: sanitizedField
      }
    );
  }

  // Validate sort order
  const sanitizedOrder = params.order.toUpperCase();
  if (!['ASC', 'DESC'].includes(sanitizedOrder)) {
    throw new AppError(
      'Invalid sort order',
      ErrorCode.VALIDATION_ERROR,
      {
        allowedOrders: ['ASC', 'DESC'],
        providedOrder: sanitizedOrder
      }
    );
  }

  return {
    field: sanitizedField,
    order: sanitizedOrder as 'ASC' | 'DESC'
  };
}