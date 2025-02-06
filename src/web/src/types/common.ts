import { z } from 'zod'; // v3.22.0

// UUID type with runtime validation
export type UUID = string & { readonly _brand: unique symbol };
const uuidSchema = z.string().uuid();

// ISO Timestamp type
export type Timestamp = string & { readonly _brand: unique symbol };
const timestampSchema = z.string().datetime();

// Base entity interface for database records
export interface BaseEntity {
  id: UUID;
  created_at: Date;
  updated_at: Date;
}

// Pagination parameters interface
export interface PaginationParams {
  page: number;
  limit: number;
}

// Pagination schema for runtime validation
export const paginationParamsSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

// Generic paginated response interface
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// Sort order enum
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

// Sort parameters interface
export interface SortParams {
  field: string;
  order: SortOrder;
  nulls_last: boolean;
}

// Sort parameters schema
export const sortParamsSchema = z.object({
  field: z.string(),
  order: z.nativeEnum(SortOrder),
  nulls_last: z.boolean()
});

// API error codes enum
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

// Generic API response interface
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code: ErrorCode | null;
  validation_errors: Record<string, string[]> | null;
  message: string | null;
}

// Utility types for null and undefined handling
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// JSON value type for type-safe JSON handling
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Helper function to create paginated responses
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  // Validate input parameters
  paginationParamsSchema.parse(params);

  const total_pages = Math.ceil(total / params.limit);
  const has_next = params.page < total_pages;
  const has_previous = params.page > 1;

  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    total_pages,
    has_next,
    has_previous
  };
}

// Base entity schema for validation
export const baseEntitySchema = z.object({
  id: uuidSchema,
  created_at: z.date(),
  updated_at: z.date()
});

// Generic API response schema factory
export function createApiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    code: z.nativeEnum(ErrorCode).nullable(),
    validation_errors: z.record(z.array(z.string())).nullable(),
    message: z.string().nullable()
  });
}

// Paginated response schema factory
export function createPaginatedResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
    has_next: z.boolean(),
    has_previous: z.boolean()
  });
}