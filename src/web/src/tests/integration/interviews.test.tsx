import { render, screen, waitFor } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // ^4.35.0
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'; // ^0.34.0
import { Server } from 'mock-socket'; // ^9.2.1
import { InterviewScheduler } from '../../components/interviews/InterviewScheduler';
import { useInterviews, useScheduleInterview } from '../../lib/hooks/useInterviews';
import { InterviewType, InterviewMode, InterviewStatus } from '../../types/interviews';
import { supabase } from '../../lib/supabase';
import { CACHE_KEYS, WEBSOCKET_CONFIG } from '../../config/constants';

// Mock data
const mockInterview = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  candidate_id: '123e4567-e89b-12d3-a456-426614174001',
  job_id: '123e4567-e89b-12d3-a456-426614174002',
  type: InterviewType.TECHNICAL,
  status: InterviewStatus.SCHEDULED,
  mode: InterviewMode.VIDEO,
  scheduled_at: new Date('2024-02-01T14:00:00Z'),
  duration_minutes: 60,
  interviewer_ids: ['123e4567-e89b-12d3-a456-426614174003'],
  meeting_link: 'https://meet.google.com/abc-defg-hij',
  calendar_event_id: 'calendar_123',
  location: null,
  notes: 'Technical interview for senior position',
  feedback: []
};

// Test setup helper
const setupTest = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  // Mock WebSocket server
  const mockServer = new Server('wss://realtime.supabase.com');
  mockServer.on('connection', socket => {
    socket.on('message', data => {
      // Handle WebSocket messages
      const message = JSON.parse(data.toString());
      if (message.type === 'broadcast') {
        socket.send(JSON.stringify({
          type: 'broadcast',
          event: message.event,
          payload: mockInterview
        }));
      }
    });
  });

  // Mock Google Calendar API
  const mockCalendar = {
    events: {
      create: vi.fn().mockResolvedValue({
        data: { id: 'calendar_123' }
      }),
      delete: vi.fn().mockResolvedValue(true)
    }
  };

  // Mock Supabase client
  vi.spyOn(supabase, 'from').mockImplementation((table) => ({
    insert: vi.fn().mockResolvedValue({ data: mockInterview, error: null }),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockInterview, error: null })
  }));

  const user = userEvent.setup();

  const renderComponent = () => render(
    <QueryClientProvider client={queryClient}>
      <InterviewScheduler
        candidateId={mockInterview.candidate_id}
        jobId={mockInterview.job_id}
        timezone="UTC"
        enableRealtime={true}
      />
    </QueryClientProvider>
  );

  return {
    user,
    mockServer,
    mockCalendar,
    renderComponent
  };
};

describe('InterviewScheduler Integration', () => {
  let cleanup: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    const { mockServer } = setupTest();
    cleanup = () => {
      mockServer.close();
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should render scheduler with initial loading state', async () => {
    const { renderComponent } = setupTest();
    renderComponent();

    expect(screen.getByText(/Interview Type/i)).toBeInTheDocument();
    expect(screen.getByText(/Interview Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Date and Time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule Interview/i })).toBeEnabled();
  });

  it('should schedule new interview with calendar integration', async () => {
    const { renderComponent, user } = setupTest();
    renderComponent();

    // Fill form
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interview Type/i }),
      InterviewType.TECHNICAL
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interview Mode/i }),
      InterviewMode.VIDEO
    );

    // Select date (assuming calendar component is rendered)
    const dateInput = screen.getByRole('textbox', { name: /Date and Time/i });
    await user.click(dateInput);
    await user.click(screen.getByRole('button', { name: new RegExp(mockInterview.scheduled_at.getDate().toString()) }));

    // Submit form
    await user.click(screen.getByRole('button', { name: /Schedule Interview/i }));

    await waitFor(() => {
      expect(screen.getByText(/Interview Scheduled/i)).toBeInTheDocument();
    });
  });

  it('should validate all form inputs with detailed errors', async () => {
    const { renderComponent, user } = setupTest();
    renderComponent();

    // Submit without filling required fields
    await user.click(screen.getByRole('button', { name: /Schedule Interview/i }));

    await waitFor(() => {
      expect(screen.getByText(/Please select an interview type/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select an interview mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select a date and time/i)).toBeInTheDocument();
    });
  });
});

describe('Interview Management Integration', () => {
  it('should handle concurrent updates via WebSocket', async () => {
    const { renderComponent, mockServer } = setupTest();
    renderComponent();

    // Simulate WebSocket update
    mockServer.emit('message', JSON.stringify({
      type: 'broadcast',
      event: 'interview_update',
      payload: {
        ...mockInterview,
        status: InterviewStatus.RESCHEDULED
      }
    }));

    await waitFor(() => {
      expect(screen.getByText(/Interview Update/i)).toBeInTheDocument();
    });
  });

  it('should maintain calendar sync during updates', async () => {
    const { renderComponent, user, mockCalendar } = setupTest();
    renderComponent();

    // Schedule interview
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interview Type/i }),
      InterviewType.TECHNICAL
    );

    await user.click(screen.getByRole('button', { name: /Schedule Interview/i }));

    await waitFor(() => {
      expect(mockCalendar.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'primary',
          requestBody: expect.objectContaining({
            summary: expect.stringContaining('TECHNICAL')
          })
        })
      );
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  it('should handle calendar sync failures', async () => {
    const { renderComponent, user, mockCalendar } = setupTest();
    
    // Mock calendar API failure
    mockCalendar.events.create.mockRejectedValueOnce(new Error('Calendar API error'));
    
    renderComponent();

    // Attempt to schedule
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interview Type/i }),
      InterviewType.TECHNICAL
    );

    await user.click(screen.getByRole('button', { name: /Schedule Interview/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to schedule interview/i)).toBeInTheDocument();
    });
  });

  it('should prevent double booking conflicts', async () => {
    const { renderComponent, user } = setupTest();
    
    // Mock existing interview at same time
    vi.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: vi.fn().mockResolvedValue({
        data: [mockInterview],
        error: null
      })
    }));

    renderComponent();

    // Attempt to schedule at same time
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Interview Type/i }),
      InterviewType.TECHNICAL
    );

    const dateInput = screen.getByRole('textbox', { name: /Date and Time/i });
    await user.click(dateInput);
    await user.click(screen.getByRole('button', { name: new RegExp(mockInterview.scheduled_at.getDate().toString()) }));

    await waitFor(() => {
      expect(screen.getByText(/Time slot already booked/i)).toBeInTheDocument();
    });
  });
});