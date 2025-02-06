import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from './common';

/**
 * Enum defining user roles with strict access control hierarchy
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  HIRING_MANAGER = 'HIRING_MANAGER',
  CANDIDATE = 'CANDIDATE',
  GUEST = 'GUEST'
}

/**
 * Comprehensive enum for authentication and authorization error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  DEVICE_NOT_RECOGNIZED = 'DEVICE_NOT_RECOGNIZED'
}

/**
 * Interface for detailed user profile information
 */
export interface UserProfile {
  avatar_url?: string;
  phone?: string;
  skills?: string[];
  location?: string;
  timezone?: string;
  linkedin_url?: string;
  certifications?: string[];
  languages?: string[];
  preferences: Record<string, any>;
  notification_settings: Record<string, boolean>;
}

/**
 * Comprehensive interface representing a user with authentication and profile details
 */
export interface User extends BaseEntity {
  email: string;
  full_name: string;
  role: UserRole;
  profile: UserProfile;
  email_verified: boolean;
  last_login: Date;
  failed_login_attempts: number;
  account_locked: boolean;
  allowed_ip_addresses: string[];
  security_questions: string[];
}

/**
 * Interface for JWT authentication tokens with enhanced security features
 */
export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  jti: string;
  device_id: string;
}

/**
 * Interface for managing user authentication sessions
 */
export interface AuthSession extends BaseEntity {
  user_id: string;
  refresh_token: string;
  expires_at: Date;
  device_id: string;
  ip_address: string;
  user_agent: string;
  device_info: Record<string, any>;
  is_active: boolean;
  revoked_at?: Date;
  revocation_reason?: string;
}

/**
 * Type for secure user login credentials
 */
export type LoginCredentials = {
  email: string;
  password: string;
  device_id?: string;
  remember_me?: boolean;
};

/**
 * Type for comprehensive user registration data
 */
export type RegisterData = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  location?: string;
  timezone?: string;
};

/**
 * Type for secure JWT token payload with claims
 */
export type JWTPayload = {
  sub: string;
  email: string;
  role: UserRole;
  exp: number;
  iat: number;
  jti: string;
  device_id: string;
  scope: string[];
};

// Zod schemas for runtime validation

export const userRoleSchema = z.nativeEnum(UserRole);

export const userProfileSchema = z.object({
  avatar_url: z.string().url().optional(),
  phone: z.string().optional(),
  skills: z.array(z.string()).optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  certifications: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  preferences: z.record(z.any()),
  notification_settings: z.record(z.boolean())
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string(),
  role: userRoleSchema,
  profile: userProfileSchema,
  email_verified: z.boolean(),
  last_login: z.date(),
  failed_login_attempts: z.number().int().min(0),
  account_locked: z.boolean(),
  allowed_ip_addresses: z.array(z.string()),
  security_questions: z.array(z.string()),
  created_at: z.date(),
  updated_at: z.date()
});

export const authTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
  scope: z.string(),
  jti: z.string().uuid(),
  device_id: z.string()
});

export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  device_id: z.string().optional(),
  remember_me: z.boolean().optional()
});

export const registerDataSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string(),
  role: userRoleSchema,
  phone: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional()
});

export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  exp: z.number().int(),
  iat: z.number().int(),
  jti: z.string().uuid(),
  device_id: z.string(),
  scope: z.array(z.string())
});