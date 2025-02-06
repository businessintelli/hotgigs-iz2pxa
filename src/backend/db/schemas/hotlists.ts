import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from '../types/common';

// Table names as constants for consistent reference
const HOTLIST_TABLE_NAME = 'hotlists';
const HOTLIST_MEMBER_TABLE_NAME = 'hotlist_members';
const HOTLIST_COLLABORATOR_TABLE_NAME = 'hotlist_collaborators';

// Default configuration values
const DEFAULT_MEMBER_LIMIT = 1000;
const MAX_COLLABORATORS = 50;

/**
 * Creates the database schema for hotlists with enhanced security and performance features
 */
export function createHotlistSchema(): string {
  return `
    -- Enable Row Level Security
    ALTER TABLE ${HOTLIST_TABLE_NAME} ENABLE ROW LEVEL SECURITY;

    -- Create hotlists table with comprehensive tracking
    CREATE TABLE IF NOT EXISTS ${HOTLIST_TABLE_NAME} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      visibility VARCHAR(20) NOT NULL CHECK (visibility IN ('PRIVATE', 'TEAM', 'PUBLIC')),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      metadata JSONB DEFAULT '{}'::JSONB,
      member_limit INTEGER NOT NULL DEFAULT ${DEFAULT_MEMBER_LIMIT},
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      version INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT valid_member_limit CHECK (member_limit >= 0 AND member_limit <= ${DEFAULT_MEMBER_LIMIT})
    );

    -- Create indexes for performance optimization
    CREATE INDEX IF NOT EXISTS idx_hotlists_owner ON ${HOTLIST_TABLE_NAME}(owner_id);
    CREATE INDEX IF NOT EXISTS idx_hotlists_visibility ON ${HOTLIST_TABLE_NAME}(visibility);
    CREATE INDEX IF NOT EXISTS idx_hotlists_tags ON ${HOTLIST_TABLE_NAME} USING GIN(tags);
    CREATE INDEX IF NOT EXISTS idx_hotlists_archived ON ${HOTLIST_TABLE_NAME}(is_archived, archived_at);
    CREATE INDEX IF NOT EXISTS idx_hotlists_search ON ${HOTLIST_TABLE_NAME} USING GIN(to_tsvector('english', name || ' ' || description));

    -- Create update trigger for timestamp management
    CREATE OR REPLACE FUNCTION update_hotlist_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      NEW.version = OLD.version + 1;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER update_hotlist_timestamp
      BEFORE UPDATE ON ${HOTLIST_TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION update_hotlist_timestamp();

    -- RLS Policies
    CREATE POLICY hotlist_owner_all ON ${HOTLIST_TABLE_NAME}
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());

    CREATE POLICY hotlist_public_view ON ${HOTLIST_TABLE_NAME}
      FOR SELECT
      TO authenticated
      USING (visibility = 'PUBLIC');

    CREATE POLICY hotlist_team_view ON ${HOTLIST_TABLE_NAME}
      FOR SELECT
      TO authenticated
      USING (
        visibility = 'TEAM' AND
        EXISTS (
          SELECT 1 FROM ${HOTLIST_COLLABORATOR_TABLE_NAME}
          WHERE hotlist_id = ${HOTLIST_TABLE_NAME}.id
          AND user_id = auth.uid()
        )
      );
  `;
}

/**
 * Creates the database schema for hotlist members with enhanced tracking
 */
export function createHotlistMemberSchema(): string {
  return `
    -- Enable Row Level Security
    ALTER TABLE ${HOTLIST_MEMBER_TABLE_NAME} ENABLE ROW LEVEL SECURITY;

    -- Create hotlist members table
    CREATE TABLE IF NOT EXISTS ${HOTLIST_MEMBER_TABLE_NAME} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hotlist_id UUID NOT NULL REFERENCES ${HOTLIST_TABLE_NAME}(id) ON DELETE CASCADE,
      candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
      notes TEXT,
      added_by UUID NOT NULL REFERENCES auth.users(id),
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      custom_fields JSONB DEFAULT '{}'::JSONB,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(hotlist_id, candidate_id)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_hotlist_members_hotlist ON ${HOTLIST_MEMBER_TABLE_NAME}(hotlist_id);
    CREATE INDEX IF NOT EXISTS idx_hotlist_members_candidate ON ${HOTLIST_MEMBER_TABLE_NAME}(candidate_id);
    CREATE INDEX IF NOT EXISTS idx_hotlist_members_featured ON ${HOTLIST_MEMBER_TABLE_NAME}(is_featured);

    -- Create member limit check trigger
    CREATE OR REPLACE FUNCTION check_hotlist_member_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      current_count INTEGER;
      member_limit INTEGER;
    BEGIN
      SELECT COUNT(*), h.member_limit 
      INTO current_count, member_limit
      FROM ${HOTLIST_MEMBER_TABLE_NAME} m
      JOIN ${HOTLIST_TABLE_NAME} h ON h.id = m.hotlist_id
      WHERE m.hotlist_id = NEW.hotlist_id
      GROUP BY h.member_limit;

      IF current_count >= member_limit THEN
        RAISE EXCEPTION 'Hotlist member limit reached';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER check_hotlist_member_limit
      BEFORE INSERT ON ${HOTLIST_MEMBER_TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION check_hotlist_member_limit();

    -- RLS Policies
    CREATE POLICY member_hotlist_access ON ${HOTLIST_MEMBER_TABLE_NAME}
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM ${HOTLIST_TABLE_NAME} h
          LEFT JOIN ${HOTLIST_COLLABORATOR_TABLE_NAME} c ON c.hotlist_id = h.id
          WHERE h.id = hotlist_id
          AND (h.owner_id = auth.uid() OR c.user_id = auth.uid())
        )
      );
  `;
}

/**
 * Creates the database schema for hotlist collaborators with role management
 */
export function createHotlistCollaboratorSchema(): string {
  return `
    -- Enable Row Level Security
    ALTER TABLE ${HOTLIST_COLLABORATOR_TABLE_NAME} ENABLE ROW LEVEL SECURITY;

    -- Create hotlist collaborators table
    CREATE TABLE IF NOT EXISTS ${HOTLIST_COLLABORATOR_TABLE_NAME} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hotlist_id UUID NOT NULL REFERENCES ${HOTLIST_TABLE_NAME}(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
      permissions JSONB DEFAULT '{}'::JSONB,
      last_accessed TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(hotlist_id, user_id)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_hotlist_collaborators_hotlist ON ${HOTLIST_COLLABORATOR_TABLE_NAME}(hotlist_id);
    CREATE INDEX IF NOT EXISTS idx_hotlist_collaborators_user ON ${HOTLIST_COLLABORATOR_TABLE_NAME}(user_id);
    CREATE INDEX IF NOT EXISTS idx_hotlist_collaborators_role ON ${HOTLIST_COLLABORATOR_TABLE_NAME}(role);

    -- Create collaborator limit check trigger
    CREATE OR REPLACE FUNCTION check_hotlist_collaborator_limit()
    RETURNS TRIGGER AS $$
    DECLARE
      current_count INTEGER;
    BEGIN
      SELECT COUNT(*)
      INTO current_count
      FROM ${HOTLIST_COLLABORATOR_TABLE_NAME}
      WHERE hotlist_id = NEW.hotlist_id;

      IF current_count >= ${MAX_COLLABORATORS} THEN
        RAISE EXCEPTION 'Maximum collaborator limit reached';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER check_hotlist_collaborator_limit
      BEFORE INSERT ON ${HOTLIST_COLLABORATOR_TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION check_hotlist_collaborator_limit();

    -- RLS Policies
    CREATE POLICY collaborator_owner_access ON ${HOTLIST_COLLABORATOR_TABLE_NAME}
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM ${HOTLIST_TABLE_NAME}
          WHERE id = hotlist_id AND owner_id = auth.uid()
        )
      );

    CREATE POLICY collaborator_self_view ON ${HOTLIST_COLLABORATOR_TABLE_NAME}
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  `;
}

// Export Zod schemas for runtime validation
export const hotlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  visibility: z.enum(['PRIVATE', 'TEAM', 'PUBLIC']),
  tags: z.array(z.string()),
  metadata: z.any(),
  member_limit: z.number().int().min(0).max(DEFAULT_MEMBER_LIMIT),
  is_archived: z.boolean(),
  archived_at: z.date().nullable()
});

export const hotlistMemberSchema = z.object({
  hotlist_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  metadata: z.any()
});

export const hotlistCollaboratorSchema = z.object({
  hotlist_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER']),
  permissions: z.array(z.string())
});