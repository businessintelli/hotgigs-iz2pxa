import { z } from 'zod'; // ^3.22.0
import { BaseEntity, JsonValue, PaginationParams } from '../types/common';
import { Candidate } from '../types/candidates';

/**
 * Enum defining visibility levels for hotlists with granular access control
 */
export enum HotlistVisibility {
  PRIVATE = 'PRIVATE',  // Only owner and explicit collaborators
  TEAM = 'TEAM',       // Visible to team members
  PUBLIC = 'PUBLIC'    // Visible across organization
}

/**
 * Enum defining role-based access control levels for hotlist collaborators
 */
export enum HotlistMemberRole {
  OWNER = 'OWNER',     // Full control and admin rights
  EDITOR = 'EDITOR',   // Can modify hotlist and members
  VIEWER = 'VIEWER'    // Read-only access
}

/**
 * Core interface for hotlist entity with enhanced metadata and security features
 */
export interface Hotlist extends BaseEntity {
  name: string;
  description: string;
  owner_id: UUID;
  visibility: HotlistVisibility;
  tags: string[];
  metadata: JsonValue;
  is_archived: boolean;
  member_limit: number;
}

/**
 * Interface for hotlist membership with enhanced tracking
 */
export interface HotlistMember extends BaseEntity {
  hotlist_id: UUID;
  candidate_id: UUID;
  notes: string;
  added_at: Date;
  added_by: UUID;
  custom_fields: JsonValue;
  is_featured: boolean;
}

/**
 * Interface for hotlist team members with role-based access
 */
export interface HotlistCollaborator extends BaseEntity {
  hotlist_id: UUID;
  user_id: UUID;
  role: HotlistMemberRole;
  last_accessed: Date;
  permissions: JsonValue;
}

/**
 * Interface for advanced hotlist search parameters
 */
export interface HotlistSearchParams extends PaginationParams {
  query: string;
  visibility: HotlistVisibility[];
  tags: string[];
  owner_id: UUID;
  include_archived: boolean;
  modified_after: Date;
  modified_before: Date;
}

/**
 * Type alias for hotlist identifier with validation
 */
export type HotlistId = UUID & { readonly brand: unique symbol };

/**
 * Extended type for hotlist with member statistics and activity metrics
 */
export type HotlistWithStats = Hotlist & {
  member_count: number;
  active_members: number;
  last_updated: Date;
  last_activity: Date;
};

/**
 * Type for type-safe hotlist update operations
 */
export type HotlistUpdatePayload = Partial<Omit<Hotlist, 'id' | 'created_at' | 'updated_at' | 'owner_id'>> & {
  version: number;
};

// Zod schema for hotlist validation
export const hotlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  owner_id: z.string().uuid(),
  visibility: z.nativeEnum(HotlistVisibility),
  tags: z.array(z.string()),
  metadata: z.any(),
  is_archived: z.boolean(),
  member_limit: z.number().int().min(0).max(1000)
});

// Zod schema for hotlist member validation
export const hotlistMemberSchema = z.object({
  hotlist_id: z.string().uuid(),
  candidate_id: z.string().uuid(),
  notes: z.string().max(500),
  added_at: z.date(),
  added_by: z.string().uuid(),
  custom_fields: z.any(),
  is_featured: z.boolean()
});

// Zod schema for hotlist collaborator validation
export const hotlistCollaboratorSchema = z.object({
  hotlist_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.nativeEnum(HotlistMemberRole),
  last_accessed: z.date(),
  permissions: z.any()
});

// Zod schema for hotlist search parameters validation
export const hotlistSearchParamsSchema = z.object({
  query: z.string(),
  visibility: z.array(z.nativeEnum(HotlistVisibility)),
  tags: z.array(z.string()),
  owner_id: z.string().uuid(),
  include_archived: z.boolean(),
  modified_after: z.date(),
  modified_before: z.date(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100)
});

// Zod schema for hotlist update payload validation
export const hotlistUpdatePayloadSchema = hotlistSchema
  .partial()
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
    owner_id: true
  })
  .extend({
    version: z.number().int().positive()
  });

// Zod schema for hotlist with stats validation
export const hotlistWithStatsSchema = hotlistSchema.extend({
  member_count: z.number().int().nonnegative(),
  active_members: z.number().int().nonnegative(),
  last_updated: z.date(),
  last_activity: z.date()
});