import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe } from '@axe-core/react';

import ActivityFeed from '../../../components/dashboard/ActivityFeed';
import StatsCard from '../../../components/dashboard/StatsCard';
import UpcomingInterviews from '../../../components/dashboard/UpcomingInterviews';
import { ActivityType, ActivityStatus } from '../../../components/dashboard/ActivityFeed';
import { InterviewType, InterviewStatus } from '../../../types/interviews';

// Mock WebSocket hook
vi.mock('../../../lib/hooks/useWebSocket', () => ({
  default: vi.fn(() => ({
    isConnected: true,
    error: null,
    connectionStatus: { isConnected: true, lastConnected: new Date(), retryCount: 0 }
  }))
}));

// Mock analytics hook
vi.mock('../../../lib/hooks/useAnalytics', () => ({
  useDashboardStats: vi.fn(() => ({
    stats: {
      total_jobs: 24,
      active_candidates: 156,
      scheduled_interviews: 12
    },
    isLoading: false,
    error: null
  }))
}));

// Mock interviews hook
vi.mock('../../../lib/hooks/useInterviews', () => ({
  useInterviews: vi.fn(() => ({
    data: mockInterviews,
    isLoading: false,
    error: null
  }))
}));

// Test data
const mockActivities = [
  {
    id: '1',
    type: ActivityType.JOB,
    title: 'New Job Posted',
    description: 'Senior React Developer position posted',
    status: ActivityStatus.INFO,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '2',
    type: ActivityType.APPLICATION,
    title: 'New Application',
    description: 'Jane Smith applied for Frontend Developer',
    status: ActivityStatus.SUCCESS,
    created_at: new Date(),
    updated_at: new Date()
  }
];

const mockInterviews = [
  {
    id: '1',
    type: InterviewType.TECHNICAL,
    status: InterviewStatus.SCHEDULED,
    candidate: { full_name: 'John Doe' },
    scheduled_at: new Date(),
    meeting_link: 'https://meet.google.com/abc',
    duration_minutes: 60
  }
];

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders activity feed with initial items', () => {
    render(<ActivityFeed />);
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByText('New Job Posted')).toBeInTheDocument();
  });

  it('handles real-time activity updates', async () => {
    const { rerender } = render(<ActivityFeed />);
    
    const newActivity = {
      id: '3',
      type: ActivityType.INTERVIEW,
      title: 'Interview Scheduled',
      description: 'Technical interview scheduled with Jane Smith',
      status: ActivityStatus.SUCCESS,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Simulate WebSocket message
    const mockWebSocket = vi.spyOn(window, 'WebSocket');
    mockWebSocket.mockImplementation(() => ({
      send: vi.fn(),
      close: vi.fn()
    }));

    rerender(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByText('Interview Scheduled')).toBeInTheDocument();
    });
  });

  it('displays error state appropriately', async () => {
    vi.mocked(useWebSocket).mockImplementation(() => ({
      isConnected: false,
      error: new Error('Connection failed'),
      connectionStatus: { isConnected: false, lastConnected: null, retryCount: 1 }
    }));

    render(<ActivityFeed />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to connect to real-time updates')).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(<ActivityFeed />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('StatsCard', () => {
  const mockIcon = () => <svg data-testid="mock-icon" />;

  it('renders stats card with correct formatting', () => {
    render(
      <StatsCard
        title="Active Jobs"
        value={1234}
        icon={mockIcon}
        aria-label="Active jobs statistics"
      />
    );

    expect(screen.getByText('Active Jobs')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('animates value changes', async () => {
    const { rerender } = render(
      <StatsCard title="Active Jobs" value={1000} icon={mockIcon} />
    );

    rerender(<StatsCard title="Active Jobs" value={1500} icon={mockIcon} />);

    await waitFor(() => {
      expect(screen.getByText('1,500')).toBeInTheDocument();
    });
  });

  it('displays tooltip when provided', () => {
    render(
      <StatsCard
        title="Active Jobs"
        value={1234}
        icon={mockIcon}
        tooltip="Total number of active job postings"
      />
    );

    fireEvent.mouseOver(screen.getByRole('article'));
    expect(screen.getByText('Total number of active job postings')).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(
      <StatsCard title="Active Jobs" value={1234} icon={mockIcon} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('UpcomingInterviews', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders upcoming interviews list', () => {
    render(<UpcomingInterviews />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('Technical Interview')).toBeInTheDocument();
  });

  it('handles empty state appropriately', () => {
    vi.mocked(useInterviews).mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null
    }));

    render(<UpcomingInterviews />);
    expect(screen.getByText('No Upcoming Interviews')).toBeInTheDocument();
  });

  it('formats interview times correctly', () => {
    const mockDate = new Date('2024-01-01T10:00:00Z');
    render(<UpcomingInterviews />);
    
    const timeElement = screen.getByRole('time');
    expect(timeElement).toHaveAttribute('dateTime', mockDate.toISOString());
  });

  it('handles loading state', () => {
    vi.mocked(useInterviews).mockImplementation(() => ({
      data: [],
      isLoading: true,
      error: null
    }));

    render(<UpcomingInterviews showLoadingState />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('handles error state', () => {
    vi.mocked(useInterviews).mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: new Error('Failed to fetch interviews')
    }));

    render(<UpcomingInterviews />);
    expect(screen.getByText('Error Loading Interviews')).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = render(<UpcomingInterviews />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    render(<UpcomingInterviews />);
    const user = userEvent.setup();

    const firstInterview = screen.getByRole('article');
    await user.tab();
    expect(firstInterview).toHaveFocus();

    const meetingLink = screen.getByRole('link', { name: /join meeting/i });
    await user.tab();
    expect(meetingLink).toHaveFocus();
  });
});