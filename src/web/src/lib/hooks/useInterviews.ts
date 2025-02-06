import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // ^4.35.0
import { useSupabaseClient } from '../supabase';
import { Interview, InterviewType, InterviewStatus, InterviewScheduleParams, interviewSchema } from '../../types/interviews';
import { CACHE_KEYS, PAGINATION_DEFAULTS } from '../../config/constants';
import { RealtimeChannel } from '@supabase/supabase-js'; // ^2.33.1
import { useGoogleCalendar } from '@google-cloud/calendar'; // ^3.0.0
import { PaginationParams } from '../../types/common';

interface InterviewFilters {
  status?: InterviewStatus;
  type?: InterviewType;
  candidateId?: string;
}

interface UseInterviewsResult {
  data: Interview[];
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  hasNextPage: boolean;
}

/**
 * Custom hook for managing interviews with real-time updates and pagination
 */
export function useInterviews(
  filters: InterviewFilters,
  pagination: PaginationParams
): UseInterviewsResult {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  
  // Query key for caching and invalidation
  const queryKey = [CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS, filters, pagination];

  // Set up real-time subscription
  const setupRealtimeSubscription = async (): Promise<RealtimeChannel> => {
    const channel = supabase.channel('interview-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'interviews' },
        (payload) => {
          queryClient.invalidateQueries(queryKey);
        }
      )
      .subscribe();

    return channel;
  };

  // Main query for fetching interviews
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('interviews')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.candidateId) {
        query = query.eq('candidate_id', filters.candidateId);
      }

      // Apply pagination
      const { from, to } = {
        from: (pagination.page - 1) * pagination.limit,
        to: pagination.page * pagination.limit - 1
      };
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        interviews: data as Interview[],
        totalCount: count || 0
      };
    },
    onError: (error) => {
      console.error('Error fetching interviews:', error);
    }
  });

  // Set up and clean up real-time subscription
  React.useEffect(() => {
    let channel: RealtimeChannel;
    
    setupRealtimeSubscription()
      .then(ch => { channel = ch; })
      .catch(error => console.error('Error setting up real-time subscription:', error));

    return () => {
      channel?.unsubscribe();
    };
  }, []);

  return {
    data: data?.interviews || [],
    isLoading,
    error: error as Error | null,
    totalCount: data?.totalCount || 0,
    hasNextPage: data ? (pagination.page * pagination.limit) < data.totalCount : false
  };
}

interface UseScheduleInterviewResult {
  scheduleInterview: (params: InterviewScheduleParams) => Promise<Interview>;
  isScheduling: boolean;
  error: Error | null;
}

/**
 * Custom hook for scheduling interviews with Google Calendar integration
 */
export function useScheduleInterview(): UseScheduleInterviewResult {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const calendar = useGoogleCalendar();

  const mutation = useMutation({
    mutationFn: async (params: InterviewScheduleParams): Promise<Interview> => {
      // Validate interview parameters
      const validatedParams = interviewSchema.parse(params);

      // Create calendar event
      const calendarEvent = await calendar.events.create({
        calendarId: 'primary',
        requestBody: {
          summary: `Interview: ${params.type}`,
          description: params.notes || '',
          start: { dateTime: params.scheduled_at.toISOString() },
          end: { 
            dateTime: new Date(
              params.scheduled_at.getTime() + params.duration_minutes * 60000
            ).toISOString()
          },
          attendees: [
            ...params.interviewer_ids.map(id => ({ email: id }))
          ],
          reminders: {
            useDefault: true
          }
        }
      });

      // Create interview record
      const { data, error } = await supabase
        .from('interviews')
        .insert({
          ...validatedParams,
          calendar_event_id: calendarEvent.data.id,
          status: InterviewStatus.SCHEDULED
        })
        .select()
        .single();

      if (error) throw error;

      return data as Interview;
    },
    onSuccess: (data) => {
      // Invalidate and refetch interviews queries
      queryClient.invalidateQueries([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS]);
      
      // Broadcast real-time update
      supabase.channel('interview-updates').send({
        type: 'broadcast',
        event: 'interview_scheduled',
        payload: data
      });
    },
    onError: (error) => {
      console.error('Error scheduling interview:', error);
      // Attempt to clean up calendar event if interview creation failed
      if ((error as any).calendarEventId) {
        calendar.events.delete({
          calendarId: 'primary',
          eventId: (error as any).calendarEventId
        }).catch(cleanupError => {
          console.error('Error cleaning up calendar event:', cleanupError);
        });
      }
    }
  });

  return {
    scheduleInterview: mutation.mutateAsync,
    isScheduling: mutation.isLoading,
    error: mutation.error as Error | null
  };
}