import { z } from 'zod'; // ^3.22.0

// Branded UUID type
export type UUID = string & { readonly _brand: unique symbol };

// Base timestamp type
export type Timestamp = string;

// Utility types for nullable and optional fields
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Comprehensive JSON value type
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Base interface for all database entities
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

// Sort order enum
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

// Sort parameters interface
export interface SortParams {
  field: string;
  order: SortOrder;
}

// Standardized error codes
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

// Error response interface
export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown> | null;
}

// Generic API response interface
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ErrorResponse | null;
}

// Paginated response interface
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Helper function to create paginated responses
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const total_pages = Math.ceil(total / params.limit);
  const page = Math.min(Math.max(1, params.page), total_pages);

  return {
    data,
    total,
    page,
    limit: params.limit,
    total_pages
  };
}

// Zod schema for UUID validation
export const uuidSchema = z.string().uuid();

// Zod schema for pagination parameters
export const paginationParamsSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

// Zod schema for sort parameters
export const sortParamsSchema = z.object({
  field: z.string(),
  order: z.nativeEnum(SortOrder)
});

// Zod schema for error response
export const errorResponseSchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
  details: z.record(z.unknown()).nullable()
});

// Zod schema for API response
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: errorResponseSchema.nullable()
  });

// Zod schema for paginated response
export const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total_pages: z.number().int().nonnegative()
  });