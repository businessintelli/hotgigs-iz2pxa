import { PostgrestError } from '@supabase/supabase-js'; // ^2.38.0
import { CalendarService } from '@google-cloud/calendar'; // ^3.0.0
import { supabase } from '../../lib/supabase';
import { 
  Interview,
  InterviewScheduleParams,
  InterviewStatus,
  interviewSchema,
  interviewScheduleSchema
} from '../../types/interviews';
import { CACHE_KEYS, ERROR_MESSAGES } from '../../config/constants';

// Initialize Google Calendar service
const calendarService = new CalendarService();

/**
 * Schedules a new interview with calendar integration and real-time notifications
 * @param params Interview scheduling parameters
 * @returns Created interview with calendar event details or error
 */
export async function scheduleInterview(
  params: InterviewScheduleParams
): Promise<{ data: Interview | null; error: PostgrestError | null }> {
  try {
    // Validate interview parameters
    const validatedParams = interviewScheduleSchema.parse(params);

    // Begin database transaction
    const { data: interview, error: dbError } = await supabase.rpc('begin_transaction');
    
    if (dbError) throw dbError;

    // Create interview record
    const { data: createdInterview, error: createError } = await supabase
      .from('interviews')
      .insert({
        ...validatedParams,
        status: InterviewStatus.SCHEDULED,
        created_at: new Date().toISOString()
      })
      .single();

    if (createError) throw createError;

    // Create Google Calendar event
    const calendarEvent = await calendarService.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Interview: ${params.type}`,
        description: params.notes || '',
        start: {
          dateTime: params.scheduled_at.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date(params.scheduled_at.getTime() + params.duration_minutes * 60000).toISOString(),
          timeZone: 'UTC'
        },
        attendees: [
          { email: createdInterview.candidate_email },
          ...params.interviewer_ids.map(id => ({ email: id }))
        ],
        conferenceData: {
          createRequest: {
            requestId: createdInterview.id,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      }
    });

    // Update interview with calendar event ID
    const { data: updatedInterview, error: updateError } = await supabase
      .from('interviews')
      .update({
        calendar_event_id: calendarEvent.data.id,
        meeting_link: calendarEvent.data.hangoutLink
      })
      .eq('id', createdInterview.id)
      .single();

    if (updateError) throw updateError;

    // Commit transaction
    await supabase.rpc('commit_transaction');

    // Send real-time notification
    await supabase.from('notifications').insert({
      type: 'INTERVIEW_SCHEDULED',
      recipient_id: params.candidate_id,
      data: {
        interview_id: createdInterview.id,
        scheduled_at: params.scheduled_at
      }
    });

    return { data: updatedInterview, error: null };

  } catch (error) {
    // Rollback transaction on error
    await supabase.rpc('rollback_transaction');
    console.error('Interview scheduling failed:', error);
    return { 
      data: null, 
      error: error as PostgrestError 
    };
  }
}

/**
 * Updates an existing interview with calendar synchronization
 * @param id Interview ID
 * @param updates Partial interview update parameters
 * @returns Updated interview with synced calendar details or error
 */
export async function updateInterview(
  id: string,
  updates: Partial<InterviewScheduleParams>
): Promise<{ data: Interview | null; error: PostgrestError | null }> {
  try {
    // Validate update parameters
    const validatedUpdates = interviewScheduleSchema.partial().parse(updates);

    // Begin transaction
    const { error: txError } = await supabase.rpc('begin_transaction');
    if (txError) throw txError;

    // Get existing interview
    const { data: existingInterview, error: fetchError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Update calendar event if scheduling changes
    if (updates.scheduled_at || updates.duration_minutes || updates.interviewer_ids) {
      await calendarService.events.update({
        calendarId: 'primary',
        eventId: existingInterview.calendar_event_id,
        requestBody: {
          start: {
            dateTime: (updates.scheduled_at || existingInterview.scheduled_at).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: new Date(
              (updates.scheduled_at || existingInterview.scheduled_at).getTime() + 
              (updates.duration_minutes || existingInterview.duration_minutes) * 60000
            ).toISOString(),
            timeZone: 'UTC'
          },
          attendees: [
            { email: existingInterview.candidate_email },
            ...(updates.interviewer_ids || existingInterview.interviewer_ids).map(id => ({ email: id }))
          ]
        }
      });
    }

    // Update interview record
    const { data: updatedInterview, error: updateError } = await supabase
      .from('interviews')
      .update({
        ...validatedUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .single();

    if (updateError) throw updateError;

    // Commit transaction
    await supabase.rpc('commit_transaction');

    // Send real-time update
    const channel = supabase.channel(`interview:${id}`);
    channel.send({
      type: 'broadcast',
      event: 'INTERVIEW_UPDATED',
      payload: updatedInterview
    });

    return { data: updatedInterview, error: null };

  } catch (error) {
    await supabase.rpc('rollback_transaction');
    console.error('Interview update failed:', error);
    return { 
      data: null, 
      error: error as PostgrestError 
    };
  }
}

/**
 * Sets up real-time WebSocket subscription for interview updates
 * @param interviewId Interview ID to subscribe to
 * @returns WebSocket subscription handler
 */
export function setupRealtimeSubscription(interviewId: string) {
  const channel = supabase.channel(`interview:${interviewId}`);

  const subscription = channel
    .on('presence', { event: 'sync' }, () => {
      console.debug('Interview presence state synchronized');
    })
    .on('broadcast', { event: 'INTERVIEW_UPDATED' }, payload => {
      // Invalidate cached interview data
      supabase.getQueryData([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_INTERVIEWS]);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          interview_id: interviewId,
          online_at: new Date().toISOString()
        });
      }
    });

  return subscription;
}