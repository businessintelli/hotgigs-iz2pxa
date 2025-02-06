-- Migration: Hotlists Tables
-- Version: 1.0.0
-- Description: Creates and configures database schema for talent pool management with enhanced security and collaboration features

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- For encryption
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gist";     -- For range indexing

-- Create hotlist visibility enum
CREATE TYPE hotlist_visibility AS ENUM (
  'private',
  'public',
  'team'
);

-- Create hotlist collaborator role enum
CREATE TYPE hotlist_role AS ENUM (
  'viewer',
  'editor',
  'admin'
);

-- Create hotlist member status enum
CREATE TYPE hotlist_member_status AS ENUM (
  'active',
  'archived',
  'removed'
);

-- Create function to check hotlist access
CREATE OR REPLACE FUNCTION check_hotlist_access(hotlist_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM hotlists h
    LEFT JOIN hotlist_collaborators hc ON h.id = hc.hotlist_id
    WHERE h.id = hotlist_id
    AND (
      h.owner_id = user_id
      OR h.visibility = 'public'
      OR (h.visibility = 'team' AND hc.user_id = user_id AND hc.invitation_status = 'accepted')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create hotlists table
CREATE TABLE public.hotlists (
  -- Base fields
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Core fields
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  visibility hotlist_visibility NOT NULL DEFAULT 'private',
  
  -- Metadata
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  last_accessed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_name_length CHECK (length(name) BETWEEN 1 AND 100),
  CONSTRAINT valid_description_length CHECK (length(description) <= 500)
);

-- Create hotlist members junction table
CREATE TABLE public.hotlist_members (
  -- Composite primary key
  hotlist_id UUID NOT NULL REFERENCES public.hotlists(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  PRIMARY KEY (hotlist_id, candidate_id),
  
  -- Member metadata
  added_by_id UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  match_score NUMERIC CHECK (match_score >= 0 AND match_score <= 100),
  status hotlist_member_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create hotlist collaborators table
CREATE TABLE public.hotlist_collaborators (
  -- Composite primary key
  hotlist_id UUID NOT NULL REFERENCES public.hotlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (hotlist_id, user_id),
  
  -- Collaboration details
  role hotlist_role NOT NULL DEFAULT 'viewer',
  invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notification_preferences JSONB DEFAULT '{}',
  last_accessed_at TIMESTAMPTZ,
  
  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for optimized queries
CREATE INDEX idx_hotlists_owner ON public.hotlists(owner_id);
CREATE INDEX idx_hotlists_visibility ON public.hotlists(visibility);
CREATE INDEX idx_hotlists_tags ON public.hotlists USING GIN(tags);
CREATE INDEX idx_hotlists_active ON public.hotlists(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_hotlists_name_trgm ON public.hotlists USING GiST (name gist_trgm_ops);

CREATE INDEX idx_hotlist_members_candidate ON public.hotlist_members(candidate_id);
CREATE INDEX idx_hotlist_members_status ON public.hotlist_members(status);
CREATE INDEX idx_hotlist_members_score ON public.hotlist_members(match_score DESC) WHERE status = 'active';

CREATE INDEX idx_hotlist_collaborators_user ON public.hotlist_collaborators(user_id);
CREATE INDEX idx_hotlist_collaborators_status ON public.hotlist_collaborators(invitation_status);
CREATE INDEX idx_hotlist_collaborators_role ON public.hotlist_collaborators(role);

-- Create triggers for timestamp management
CREATE TRIGGER update_hotlists_timestamp
  BEFORE UPDATE ON public.hotlists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotlist_members_timestamp
  BEFORE UPDATE ON public.hotlist_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hotlist_collaborators_timestamp
  BEFORE UPDATE ON public.hotlist_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.hotlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotlist_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotlist_collaborators ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY hotlists_select ON public.hotlists
  FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
    OR owner_id::text = auth.jwt() ->> 'sub'
    OR visibility = 'public'
    OR EXISTS (
      SELECT 1 FROM public.hotlist_collaborators
      WHERE hotlist_id = id
      AND user_id::text = auth.jwt() ->> 'sub'
      AND invitation_status = 'accepted'
    )
  );

CREATE POLICY hotlists_insert ON public.hotlists
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'role' IN ('ADMIN', 'RECRUITER')
  );

CREATE POLICY hotlists_update ON public.hotlists
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'ADMIN'
    OR owner_id::text = auth.jwt() ->> 'sub'
    OR EXISTS (
      SELECT 1 FROM public.hotlist_collaborators
      WHERE hotlist_id = id
      AND user_id::text = auth.jwt() ->> 'sub'
      AND role IN ('editor', 'admin')
    )
  );

CREATE POLICY hotlist_members_select ON public.hotlist_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotlists
      WHERE id = hotlist_id
      AND check_hotlist_access(id, auth.jwt() ->> 'sub'::UUID)
    )
  );

CREATE POLICY hotlist_collaborators_select ON public.hotlist_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hotlists
      WHERE id = hotlist_id
      AND (
        owner_id::text = auth.jwt() ->> 'sub'
        OR auth.jwt() ->> 'role' = 'ADMIN'
      )
    )
  );

-- Add audit logging
CREATE TRIGGER audit_hotlists_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.hotlists
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_hotlist_members_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.hotlist_members
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

CREATE TRIGGER audit_hotlist_collaborators_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.hotlist_collaborators
  FOR EACH ROW EXECUTE FUNCTION audit.log_changes();

-- Add comments for documentation
COMMENT ON TABLE public.hotlists IS 'Curated lists of candidates with enhanced collaboration features';
COMMENT ON TABLE public.hotlist_members IS 'Junction table tracking candidates in hotlists with status and metadata';
COMMENT ON TABLE public.hotlist_collaborators IS 'Junction table managing hotlist sharing and collaboration permissions';