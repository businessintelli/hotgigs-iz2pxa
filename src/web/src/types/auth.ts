import { z } from 'zod'; // v3.22.0
import { BaseEntity } from './common';

/**
 * Comprehensive enum defining all available user roles with granular access levels
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  HIRING_MANAGER = 'HIRING_MANAGER',
  CANDIDATE = 'CANDIDATE',
  GUEST = 'GUEST'
}

/**
 * Detailed authentication states for frontend state management
 */
export enum AuthStatus {
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED'
}

/**
 * Extended user profile interface with comprehensive user details
 */
export interface UserProfile {
  avatar_url: string | null;
  phone: string | null;
  skills: string[];
  location: string | null;
  timezone: string;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  languages: string[];
  preferences: Record<string, any>;
  notifications_settings: Record<string, boolean>;
  social_links: Record<string, string>;
}

/**
 * Comprehensive user interface with extended profile information
 */
export interface User extends BaseEntity {
  email: string;
  full_name: string;
  role: UserRole;
  profile: UserProfile;
  email_verified: boolean;
  last_login: Date;
  permissions: string[];
  refresh_token: string | null;
  token_expiry: Date | null;
}

/**
 * Comprehensive authentication state interface with error handling
 */
export interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  isLoading: boolean;
  lastAuthenticated: Date | null;
  attemptCount: number;
  metadata: Record<string, any>;
}

/**
 * Type for secure login form data with validation
 */
export type LoginCredentials = {
  email: string;
  password: string;
  remember_me?: boolean;
  captcha?: string;
}

/**
 * Comprehensive registration form data type
 */
export type RegisterData = {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  terms_accepted: boolean;
  profile?: Partial<UserProfile>;
}

/**
 * Enhanced password reset form data type
 */
export type ResetPasswordData = {
  email: string;
  token?: string;
  new_password?: string;
}

/**
 * Extended authentication context interface with comprehensive auth operations
 */
export interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshToken: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  socialLogin: (provider: string) => Promise<void>;
}

// Zod validation schemas for runtime type checking
export const userProfileSchema = z.object({
  avatar_url: z.string().nullable(),
  phone: z.string().nullable(),
  skills: z.array(z.string()),
  location: z.string().nullable(),
  timezone: z.string(),
  linkedin_url: z.string().url().nullable(),
  github_url: z.string().url().nullable(),
  portfolio_url: z.string().url().nullable(),
  languages: z.array(z.string()),
  preferences: z.record(z.any()),
  notifications_settings: z.record(z.boolean()),
  social_links: z.record(z.string())
});

export const loginCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember_me: z.boolean().optional(),
  captcha: z.string().optional()
});

export const registerDataSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.nativeEnum(UserRole),
  terms_accepted: z.literal(true),
  profile: userProfileSchema.partial().optional()
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().optional(),
  new_password: z.string().min(8).optional()
});

export const userSchema = z.object({
  email: z.string().email(),
  full_name: z.string(),
  role: z.nativeEnum(UserRole),
  profile: userProfileSchema,
  email_verified: z.boolean(),
  last_login: z.date(),
  permissions: z.array(z.string()),
  refresh_token: z.string().nullable(),
  token_expiry: z.date().nullable()
}).merge(z.object({
  id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date()
}));