import { z } from 'zod'; // v3.22.0
import { BaseEntity, PaginationParams, UUID } from './common';
import { Candidate } from './candidates';

// Enums for hotlist management
export enum HotlistVisibility {
  PRIVATE = 'PRIVATE',  // Only owner can access
  TEAM = 'TEAM',       // Team members can access
  PUBLIC = 'PUBLIC'    // All system users can access
}

export enum CollaboratorRole {
  OWNER = 'OWNER',     // Full control over hotlist
  EDITOR = 'EDITOR',   // Can modify hotlist and manage members
  VIEWER = 'VIEWER'    // Can only view hotlist contents
}

export enum HotlistAuditAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  COLLABORATOR_ADDED = 'COLLABORATOR_ADDED',
  COLLABORATOR_REMOVED = 'COLLABORATOR_REMOVED'
}

// Core interfaces
export interface Hotlist extends BaseEntity {
  name: string;
  description: string;
  visibility: HotlistVisibility;
  tags: string[];
  owner_id: UUID;
  member_count: number;
  collaborator_count: number;
  last_activity_at: Date;
  is_archived: boolean;
}

export interface HotlistMember extends BaseEntity {
  hotlist_id: UUID;
  candidate_id: UUID;
  notes: string;
  added_at: Date;
  added_by_id: UUID;
  internal_tags: string[];
  is_featured: boolean;
}

export interface HotlistCollaborator extends BaseEntity {
  hotlist_id: UUID;
  user_id: UUID;
  role: CollaboratorRole;
  joined_at: Date;
  invited_by_id: UUID;
  access_notes: string;
  last_accessed_at: Date;
  notifications_enabled: boolean;
}

export interface HotlistSearchParams extends PaginationParams {
  query: string;
  visibility: HotlistVisibility[];
  tags: string[];
  owner_id: UUID;
  include_archived: boolean;
  modified_after: Date;
  modified_before: Date;
  min_members: number;
}

export interface HotlistAuditLog extends BaseEntity {
  hotlist_id: UUID;
  user_id: UUID;
  action: HotlistAuditAction;
  changes: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
}

// Composite types
export type HotlistFormData = Omit<
  Hotlist,
  'id' | 'created_at' | 'updated_at' | 'member_count' | 'collaborator_count' | 'last_activity_at'
>;

export type HotlistWithMembers = Hotlist & {
  members: Array<
    Candidate & {
      notes?: string;
      added_at: Date;
      added_by: User;
      is_featured: boolean;
    }
  >;
};

export type HotlistWithCollaborators = Hotlist & {
  collaborators: Array<HotlistCollaborator & { user: User }>;
};

export type HotlistPermissions = {
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_manage_members: boolean;
  can_manage_collaborators: boolean;
};

// Zod validation schemas
export const hotlistVisibilitySchema = z.nativeEnum(HotlistVisibility);

export const collaboratorRoleSchema = z.nativeEnum(CollaboratorRole);

export const hotlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  visibility: hotlistVisibilitySchema,
  tags: z.array(z.string()),
  owner_id: z.string().uuid(),
  member_count: z.number().min(0),
  collaborator_count: z.number().min(0),
  last_activity_at: z.date(),
  is_archived: z.boolean()
});

export const hotlistMemberSchema = z.object({
  hotlist_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  notes: z.string().max(500),
  added_at: z.date(),
  added_by_id: z.string().uuid(),
  internal_tags: z.array(z.string()),
  is_featured: z.boolean()
});

export const hotlistCollaboratorSchema = z.object({
  hotlist_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: collaboratorRoleSchema,
  joined_at: z.date(),
  invited_by_id: z.string().uuid(),
  access_notes: z.string().max(200),
  last_accessed_at: z.date(),
  notifications_enabled: z.boolean()
});

export const hotlistSearchParamsSchema = z.object({
  query: z.string(),
  visibility: z.array(hotlistVisibilitySchema),
  tags: z.array(z.string()),
  owner_id: z.string().uuid(),
  include_archived: z.boolean(),
  modified_after: z.date(),
  modified_before: z.date(),
  min_members: z.number().min(0)
}).extend({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

export const hotlistAuditLogSchema = z.object({
  hotlist_id: z.string().uuid(),
  user_id: z.string().uuid(),
  action: z.nativeEnum(HotlistAuditAction),
  changes: z.record(z.unknown()),
  ip_address: z.string(),
  user_agent: z.string()
});

// Type guard functions
export const isHotlistOwner = (
  hotlist: Hotlist,
  userId: UUID
): boolean => hotlist.owner_id === userId;

export const canManageHotlist = (
  hotlist: Hotlist,
  collaborator: HotlistCollaborator
): boolean => {
  return (
    collaborator.role === CollaboratorRole.OWNER ||
    collaborator.role === CollaboratorRole.EDITOR
  );
};

export const getHotlistPermissions = (
  hotlist: Hotlist,
  collaborator?: HotlistCollaborator
): HotlistPermissions => {
  if (!collaborator) {
    return {
      can_view: hotlist.visibility === HotlistVisibility.PUBLIC,
      can_edit: false,
      can_delete: false,
      can_manage_members: false,
      can_manage_collaborators: false
    };
  }

  const isOwner = collaborator.role === CollaboratorRole.OWNER;
  const isEditor = collaborator.role === CollaboratorRole.EDITOR;

  return {
    can_view: true,
    can_edit: isOwner || isEditor,
    can_delete: isOwner,
    can_manage_members: isOwner || isEditor,
    can_manage_collaborators: isOwner
  };
};