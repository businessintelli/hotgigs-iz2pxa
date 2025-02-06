import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from '../types/common';
import { UserRole } from '../types/auth';

/**
 * Enhanced Zod schema for user table with comprehensive security features
 */
export const userSchema = z.object({
  ...BaseEntity,
  email: z.string().email(),
  password_hash: z.string().min(60), // bcrypt hash length
  full_name: z.string().min(2).max(100),
  role: z.nativeEnum(UserRole),
  email_verified: z.boolean().default(false),
  failed_attempts: z.number().int().min(0).default(0),
  account_locked: z.boolean().default(false),
  account_locked_until: z.date().nullable(),
  last_login: z.date().nullable(),
  last_password_change: z.date(),
  password_history: z.array(z.object({
    hash: z.string(),
    changed_at: z.date()
  })).default([]),
  allowed_ip_addresses: z.array(z.string().ip()).default([]),
  mfa_enabled: z.boolean().default(false),
  mfa_secret: z.string().nullable(),
  security_settings: z.object({
    require_mfa: z.boolean().default(false),
    password_expiry_days: z.number().int().min(0).default(90),
    max_sessions: z.number().int().min(1).default(5),
    ip_whitelist_enabled: z.boolean().default(false)
  }).default({}),
  profile: z.object({
    avatar_url: z.string().url().nullable(),
    phone: z.string().nullable(),
    timezone: z.string().default('UTC'),
    notification_preferences: z.record(z.boolean()).default({})
  }).default({})
});

/**
 * Enhanced Zod schema for authentication sessions with security tracking
 */
export const authSessionSchema = z.object({
  ...BaseEntity,
  user_id: z.string().uuid(),
  refresh_token_hash: z.string(),
  expires_at: z.date(),
  revoked_at: z.date().nullable(),
  revocation_reason: z.string().nullable(),
  device_fingerprint: z.string(),
  device_info: z.object({
    user_agent: z.string(),
    os: z.string(),
    browser: z.string(),
    device_type: z.string()
  }),
  ip_address: z.string().ip(),
  ip_location: z.object({
    country: z.string(),
    region: z.string(),
    city: z.string()
  }).nullable(),
  last_active_at: z.date(),
  activity_log: z.array(z.object({
    timestamp: z.date(),
    action: z.string(),
    ip_address: z.string().ip(),
    success: z.boolean(),
    failure_reason: z.string().nullable()
  })).default([])
});

/**
 * Creates the database schema for users table with enhanced RLS policies
 */
export function createUserSchema(): string {
  return `
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'CANDIDATE', 'GUEST')),
      email_verified BOOLEAN DEFAULT FALSE,
      failed_attempts INTEGER DEFAULT 0,
      account_locked BOOLEAN DEFAULT FALSE,
      account_locked_until TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      last_password_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      password_history JSONB DEFAULT '[]',
      allowed_ip_addresses TEXT[] DEFAULT '{}',
      mfa_enabled BOOLEAN DEFAULT FALSE,
      mfa_secret TEXT,
      security_settings JSONB NOT NULL DEFAULT '{"require_mfa": false, "password_expiry_days": 90, "max_sessions": 5, "ip_whitelist_enabled": false}',
      profile JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
    );

    -- Indexes for performance optimization
    CREATE INDEX idx_users_email ON auth.users (email);
    CREATE INDEX idx_users_role ON auth.users (role);
    CREATE INDEX idx_users_email_verified ON auth.users (email_verified);

    -- Auto-update updated_at timestamp
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- RLS Policies
    ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

    -- Admins can do everything
    CREATE POLICY admin_all ON auth.users
      TO authenticated
      USING (auth.jwt() ->> 'role' = 'ADMIN');

    -- Users can read their own data
    CREATE POLICY user_select ON auth.users
      FOR SELECT
      TO authenticated
      USING (id::text = auth.jwt() ->> 'sub');

    -- Users can update their own non-sensitive data
    CREATE POLICY user_update ON auth.users
      FOR UPDATE
      TO authenticated
      USING (id::text = auth.jwt() ->> 'sub')
      WITH CHECK (id::text = auth.jwt() ->> 'sub' AND role = OLD.role);
  `;
}

/**
 * Creates the database schema for auth sessions with comprehensive security features
 */
export function createAuthSessionSchema(): string {
  return `
    CREATE TABLE auth.sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      revocation_reason TEXT,
      device_fingerprint TEXT NOT NULL,
      device_info JSONB NOT NULL,
      ip_address INET NOT NULL,
      ip_location JSONB,
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activity_log JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT valid_expires_at CHECK (expires_at > created_at)
    );

    -- Indexes for performance
    CREATE INDEX idx_sessions_user_id ON auth.sessions (user_id);
    CREATE INDEX idx_sessions_expires_at ON auth.sessions (expires_at);
    CREATE INDEX idx_sessions_device_fingerprint ON auth.sessions (device_fingerprint);

    -- Auto-update updated_at timestamp
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON auth.sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- RLS Policies
    ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

    -- Admins can do everything
    CREATE POLICY admin_all ON auth.sessions
      TO authenticated
      USING (auth.jwt() ->> 'role' = 'ADMIN');

    -- Users can only access their own sessions
    CREATE POLICY user_select ON auth.sessions
      FOR SELECT
      TO authenticated
      USING (user_id::text = auth.jwt() ->> 'sub');

    -- Automatic session cleanup
    CREATE OR REPLACE FUNCTION auth.cleanup_expired_sessions()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      DELETE FROM auth.sessions
      WHERE expires_at < NOW()
      OR revoked_at IS NOT NULL;
    END;
    $$;

    -- Schedule cleanup job
    SELECT cron.schedule(
      'cleanup-expired-sessions',
      '0 * * * *', -- Every hour
      $$SELECT auth.cleanup_expired_sessions()$$
    );
  `;
}