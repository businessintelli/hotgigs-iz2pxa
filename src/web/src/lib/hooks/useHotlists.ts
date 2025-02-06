import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // ^4.0.0
import { useSubscription } from '@supabase/supabase-js'; // ^2.0.0
import { useEffect } from 'react';
import type { 
  Hotlist, 
  HotlistMember, 
  HotlistSearchParams,
  HotlistVisibility,
  HotlistAuditAction 
} from '../../types/hotlists';
import { useToast } from '../hooks/useToast';

// Query keys for cache management
const HOTLISTS_QUERY_KEY = 'hotlists';
const HOTLIST_MEMBERS_QUERY_KEY = 'hotlist-members';

interface UseHotlistsOptions {
  searchParams: HotlistSearchParams;
  enableRealtime?: boolean;
}

interface HotlistsResponse {
  data: Hotlist[];
  count: number;
  hasMore: boolean;
}

export function useHotlists({ searchParams, enableRealtime = true }: UseHotlistsOptions) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Set up real-time subscription for hotlist updates
  useEffect(() => {
    if (!enableRealtime) return;

    const subscription = supabase
      .from('hotlists')
      .on('INSERT', (payload) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        toast.info({
          title: 'New Hotlist Created',
          description: `${payload.new.name} has been added`
        });
      })
      .on('UPDATE', (payload) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        if (payload.new.is_archived && !payload.old.is_archived) {
          toast.warning({
            title: 'Hotlist Archived',
            description: `${payload.new.name} has been archived`
          });
        }
      })
      .on('DELETE', (payload) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        toast.error({
          title: 'Hotlist Deleted',
          description: `A hotlist has been removed`
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient, toast, enableRealtime]);

  // Main query for fetching hotlists
  const { data, isLoading, error } = useQuery<HotlistsResponse, Error>(
    [HOTLISTS_QUERY_KEY, searchParams],
    async () => {
      const response = await fetch('/api/hotlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch hotlists');
      }

      return response.json();
    },
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );

  // Mutation for creating new hotlists
  const createHotlist = useMutation<Hotlist, Error, Omit<Hotlist, 'id' | 'created_at' | 'updated_at'>>(
    async (newHotlist) => {
      const response = await fetch('/api/hotlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newHotlist),
      });

      if (!response.ok) {
        throw new Error('Failed to create hotlist');
      }

      return response.json();
    },
    {
      onSuccess: (newHotlist) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        toast.success({
          title: 'Hotlist Created',
          description: `${newHotlist.name} has been created successfully`
        });
      },
      onError: (error) => {
        toast.error({
          title: 'Creation Failed',
          description: error.message
        });
      }
    }
  );

  // Mutation for updating existing hotlists
  const updateHotlist = useMutation<Hotlist, Error, Partial<Hotlist> & { id: string }>(
    async (updatedHotlist) => {
      const response = await fetch(`/api/hotlists/${updatedHotlist.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedHotlist),
      });

      if (!response.ok) {
        throw new Error('Failed to update hotlist');
      }

      return response.json();
    },
    {
      onSuccess: (updatedHotlist) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        toast.success({
          title: 'Hotlist Updated',
          description: `${updatedHotlist.name} has been updated successfully`
        });
      },
      onError: (error) => {
        toast.error({
          title: 'Update Failed',
          description: error.message
        });
      }
    }
  );

  // Mutation for deleting hotlists
  const deleteHotlist = useMutation<void, Error, string>(
    async (hotlistId) => {
      const response = await fetch(`/api/hotlists/${hotlistId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete hotlist');
      }
    },
    {
      onSuccess: (_, hotlistId) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        toast.success({
          title: 'Hotlist Deleted',
          description: 'The hotlist has been deleted successfully'
        });
      },
      onError: (error) => {
        toast.error({
          title: 'Deletion Failed',
          description: error.message
        });
      }
    }
  );

  // Mutation for managing hotlist members
  const manageHotlistMember = useMutation<HotlistMember, Error, { 
    hotlistId: string; 
    candidateId: string; 
    action: 'add' | 'remove';
    notes?: string;
  }>(
    async ({ hotlistId, candidateId, action, notes }) => {
      const response = await fetch(`/api/hotlists/${hotlistId}/members`, {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ candidateId, notes }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} member to hotlist`);
      }

      return response.json();
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries([HOTLISTS_QUERY_KEY]);
        queryClient.invalidateQueries([HOTLIST_MEMBERS_QUERY_KEY, variables.hotlistId]);
        toast.success({
          title: `Member ${variables.action === 'add' ? 'Added' : 'Removed'}`,
          description: `Candidate has been ${variables.action === 'add' ? 'added to' : 'removed from'} the hotlist`
        });
      },
      onError: (error, variables) => {
        toast.error({
          title: `${variables.action === 'add' ? 'Add' : 'Remove'} Failed`,
          description: error.message
        });
      }
    }
  );

  return {
    data: data?.data ?? [],
    count: data?.count ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    createHotlist,
    updateHotlist,
    deleteHotlist,
    manageHotlistMember,
    isRealTimeEnabled: enableRealtime
  };
}