import { PostgrestError } from '@supabase/supabase-js'; // ^2.38.0
import { supabase } from '../supabase';
import { 
  Hotlist, 
  HotlistFormData, 
  HotlistVisibility, 
  HotlistAuditAction,
  HotlistCollaborator,
  HotlistMember,
  hotlistSchema,
  hotlistCollaboratorSchema,
  hotlistMemberSchema
} from '../../types/hotlists';
import { ApiResponse, UUID, ErrorCode } from '../../types/common';
import { API_RATE_LIMITS, WEBSOCKET_CONFIG } from '../../config/constants';

/**
 * Creates a new hotlist with audit logging and real-time capabilities
 * @param data Hotlist creation data
 * @param metadata Additional metadata for audit logging
 */
export async function createHotlist(
  data: HotlistFormData,
  metadata: { user_id: UUID; ip_address: string; user_agent: string }
): Promise<ApiResponse<Hotlist>> {
  try {
    // Validate input data
    const validatedData = hotlistSchema.parse(data);

    // Check rate limits
    const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
      resource: 'hotlists',
      limit: API_RATE_LIMITS.JOBS.limit,
      window: API_RATE_LIMITS.JOBS.window
    });

    if (!rateLimit?.allowed) {
      return {
        success: false,
        data: null,
        error: 'Rate limit exceeded',
        code: ErrorCode.RATE_LIMITED,
        validation_errors: null,
        message: `Please try again after ${API_RATE_LIMITS.JOBS.retryAfter} seconds`
      };
    }

    // Start transaction
    const { data: hotlist, error } = await supabase.rpc('create_hotlist_with_audit', {
      hotlist_data: validatedData,
      audit_data: {
        action: HotlistAuditAction.CREATED,
        user_id: metadata.user_id,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent
      }
    });

    if (error) throw error;

    // Set up real-time subscription channel
    const channel = supabase.channel(`hotlist:${hotlist.id}`, {
      config: {
        broadcast: { self: true },
        presence: { key: metadata.user_id }
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          online_at: new Date().toISOString(),
          user_id: metadata.user_id
        });
      }
    });

    return {
      success: true,
      data: hotlist,
      error: null,
      code: null,
      validation_errors: null,
      message: 'Hotlist created successfully'
    };

  } catch (error) {
    if (error instanceof PostgrestError) {
      return {
        success: false,
        data: null,
        error: error.message,
        code: ErrorCode.INTERNAL_ERROR,
        validation_errors: null,
        message: 'Database error occurred'
      };
    }

    return {
      success: false,
      data: null,
      error: 'Failed to create hotlist',
      code: ErrorCode.INTERNAL_ERROR,
      validation_errors: null,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Updates an existing hotlist with audit logging
 * @param id Hotlist ID
 * @param data Update data
 * @param metadata Audit metadata
 */
export async function updateHotlist(
  id: UUID,
  data: Partial<HotlistFormData>,
  metadata: { user_id: UUID; ip_address: string; user_agent: string }
): Promise<ApiResponse<Hotlist>> {
  try {
    const { data: hotlist, error } = await supabase.rpc('update_hotlist_with_audit', {
      hotlist_id: id,
      update_data: data,
      audit_data: {
        action: HotlistAuditAction.UPDATED,
        user_id: metadata.user_id,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        changes: data
      }
    });

    if (error) throw error;

    return {
      success: true,
      data: hotlist,
      error: null,
      code: null,
      validation_errors: null,
      message: 'Hotlist updated successfully'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to update hotlist',
      code: ErrorCode.INTERNAL_ERROR,
      validation_errors: null,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Sets up real-time subscription for hotlist updates
 * @param hotlistId Hotlist ID to subscribe to
 * @param options Subscription options
 */
export function subscribeToHotlist(
  hotlistId: UUID,
  options: {
    onUpdate?: (payload: Hotlist) => void;
    onMemberChange?: (payload: HotlistMember) => void;
    onCollaboratorChange?: (payload: HotlistCollaborator) => void;
    onError?: (error: Error) => void;
  }
) {
  const channel = supabase.channel(`hotlist:${hotlistId}`, {
    config: {
      broadcast: { self: true },
      presence: { key: crypto.randomUUID() }
    }
  });

  let retryCount = 0;
  const maxRetries = WEBSOCKET_CONFIG.maxRetries;

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.debug('Hotlist presence state:', state);
    })
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public',
      table: 'hotlists',
      filter: `id=eq.${hotlistId}`
    }, (payload) => {
      options.onUpdate?.(payload.new as Hotlist);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'hotlist_members',
      filter: `hotlist_id=eq.${hotlistId}`
    }, (payload) => {
      options.onMemberChange?.(payload.new as HotlistMember);
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'hotlist_collaborators',
      filter: `hotlist_id=eq.${hotlistId}`
    }, (payload) => {
      options.onCollaboratorChange?.(payload.new as HotlistCollaborator);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        retryCount = 0;
      } else if (status === 'CLOSED' && retryCount < maxRetries) {
        retryCount++;
        setTimeout(() => {
          channel.subscribe();
        }, WEBSOCKET_CONFIG.reconnectInterval * retryCount);
      } else if (status === 'CLOSED') {
        options.onError?.(new Error('Failed to maintain hotlist subscription'));
      }
    });

  return {
    unsubscribe: () => {
      channel.unsubscribe();
    }
  };
}

/**
 * Adds a member to a hotlist with audit logging
 * @param hotlistId Hotlist ID
 * @param memberId Candidate ID to add
 * @param metadata Audit metadata
 */
export async function addHotlistMember(
  hotlistId: UUID,
  memberId: UUID,
  metadata: { 
    user_id: UUID; 
    notes?: string;
    internal_tags?: string[];
    ip_address: string;
    user_agent: string;
  }
): Promise<ApiResponse<HotlistMember>> {
  try {
    const memberData = {
      hotlist_id: hotlistId,
      candidate_id: memberId,
      notes: metadata.notes || '',
      added_by_id: metadata.user_id,
      internal_tags: metadata.internal_tags || [],
      is_featured: false
    };

    const validatedData = hotlistMemberSchema.parse(memberData);

    const { data: member, error } = await supabase.rpc('add_hotlist_member_with_audit', {
      member_data: validatedData,
      audit_data: {
        action: HotlistAuditAction.MEMBER_ADDED,
        user_id: metadata.user_id,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent
      }
    });

    if (error) throw error;

    return {
      success: true,
      data: member,
      error: null,
      code: null,
      validation_errors: null,
      message: 'Member added successfully'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to add member',
      code: ErrorCode.INTERNAL_ERROR,
      validation_errors: null,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Adds a collaborator to a hotlist with audit logging
 * @param hotlistId Hotlist ID
 * @param collaboratorData Collaborator data
 * @param metadata Audit metadata
 */
export async function addHotlistCollaborator(
  hotlistId: UUID,
  collaboratorData: Omit<HotlistCollaborator, 'id' | 'created_at' | 'updated_at'>,
  metadata: { user_id: UUID; ip_address: string; user_agent: string }
): Promise<ApiResponse<HotlistCollaborator>> {
  try {
    const validatedData = hotlistCollaboratorSchema.parse({
      ...collaboratorData,
      hotlist_id: hotlistId,
      invited_by_id: metadata.user_id
    });

    const { data: collaborator, error } = await supabase.rpc('add_hotlist_collaborator_with_audit', {
      collaborator_data: validatedData,
      audit_data: {
        action: HotlistAuditAction.COLLABORATOR_ADDED,
        user_id: metadata.user_id,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent
      }
    });

    if (error) throw error;

    return {
      success: true,
      data: collaborator,
      error: null,
      code: null,
      validation_errors: null,
      message: 'Collaborator added successfully'
    };

  } catch (error) {
    return {
      success: false,
      data: null,
      error: 'Failed to add collaborator',
      code: ErrorCode.INTERNAL_ERROR,
      validation_errors: null,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}