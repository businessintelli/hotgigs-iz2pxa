import * as React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toHaveNoViolations } from "jest-axe";

import InterviewDetails from "../../../components/interviews/InterviewDetails";
import InterviewScheduler from "../../../components/interviews/InterviewScheduler";
import InterviewList from "../../../components/interviews/InterviewList";
import { InterviewType, InterviewStatus, InterviewMode } from "../../../types/interviews";

// Mock data
const mockInterview = {
  id: "test-interview-id",
  candidate_id: "test-candidate-id",
  job_id: "test-job-id",
  type: InterviewType.TECHNICAL,
  status: InterviewStatus.SCHEDULED,
  mode: InterviewMode.VIDEO,
  scheduled_at: new Date("2024-01-01T10:00:00Z"),
  duration_minutes: 60,
  interviewer_ids: ["interviewer-1"],
  meeting_link: "https://meet.google.com/test",
  calendar_event_id: "calendar-event-1",
  location: "Virtual",
  notes: "Technical interview for senior position",
  feedback: [],
  created_at: new Date("2023-12-25T10:00:00Z"),
  updated_at: new Date("2023-12-25T10:00:00Z")
};

// Test utilities
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    )
  };
};

describe("InterviewDetails", () => {
  beforeEach(() => {
    vi.mock("../../../lib/hooks/useInterviews", () => ({
      useInterview: () => ({ data: mockInterview, isLoading: false }),
      useUpdateInterview: () => ({ mutateAsync: vi.fn() }),
      useCancelInterview: () => ({ mutateAsync: vi.fn() })
    }));
  });

  it("renders interview details correctly", async () => {
    const { user } = renderWithProviders(
      <InterviewDetails interviewId={mockInterview.id} />
    );

    // Verify basic information display
    expect(screen.getByText("Interview Details")).toBeInTheDocument();
    expect(screen.getByText(InterviewType.TECHNICAL)).toBeInTheDocument();
    expect(screen.getByText(InterviewStatus.SCHEDULED)).toBeInTheDocument();

    // Verify schedule information
    expect(screen.getByText(/January 1, 2024 at 10:00 AM/)).toBeInTheDocument();

    // Verify action buttons
    expect(screen.getByRole("button", { name: /Reschedule/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeEnabled();

    // Test accessibility
    const results = await axe(screen.container);
    expect(results).toHaveNoViolations();
  });

  it("handles interview cancellation", async () => {
    const cancelMock = vi.fn();
    vi.mocked(useCancelInterview).mockReturnValue({ mutateAsync: cancelMock });

    const { user } = renderWithProviders(
      <InterviewDetails interviewId={mockInterview.id} />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelButton);

    expect(cancelMock).toHaveBeenCalledWith(mockInterview.id);
  });
});

describe("InterviewScheduler", () => {
  const onScheduledMock = vi.fn();

  beforeEach(() => {
    vi.mock("../../../lib/hooks/useInterviews", () => ({
      useScheduleInterview: () => ({
        scheduleInterview: vi.fn(),
        isScheduling: false
      })
    }));
  });

  it("renders scheduler form with all fields", () => {
    renderWithProviders(
      <InterviewScheduler
        candidateId="test-candidate"
        jobId="test-job"
        onScheduled={onScheduledMock}
      />
    );

    // Verify form fields
    expect(screen.getByLabelText(/Interview Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interview Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date and Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location or Meeting Link/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Additional Notes/i)).toBeInTheDocument();
  });

  it("validates form submission", async () => {
    const { user } = renderWithProviders(
      <InterviewScheduler
        candidateId="test-candidate"
        jobId="test-job"
        onScheduled={onScheduledMock}
      />
    );

    // Submit without required fields
    const submitButton = screen.getByRole("button", { name: /Schedule Interview/i });
    await user.click(submitButton);

    // Verify validation messages
    expect(screen.getByText(/Please select a time during business hours/i)).toBeInTheDocument();
  });

  it("handles successful interview scheduling", async () => {
    const scheduleMock = vi.fn().mockResolvedValue(mockInterview);
    vi.mocked(useScheduleInterview).mockReturnValue({
      scheduleInterview: scheduleMock,
      isScheduling: false
    });

    const { user } = renderWithProviders(
      <InterviewScheduler
        candidateId="test-candidate"
        jobId="test-job"
        onScheduled={onScheduledMock}
      />
    );

    // Fill form fields
    await user.selectOptions(
      screen.getByLabelText(/Interview Type/i),
      InterviewType.TECHNICAL
    );
    await user.selectOptions(
      screen.getByLabelText(/Interview Mode/i),
      InterviewMode.VIDEO
    );
    await user.type(
      screen.getByLabelText(/Location or Meeting Link/i),
      "https://meet.google.com/test"
    );

    // Submit form
    await user.click(screen.getByRole("button", { name: /Schedule Interview/i }));

    expect(scheduleMock).toHaveBeenCalled();
    expect(onScheduledMock).toHaveBeenCalledWith(mockInterview);
  });
});

describe("InterviewList", () => {
  const mockInterviews = Array.from({ length: 20 }, (_, i) => ({
    ...mockInterview,
    id: `interview-${i}`,
    scheduled_at: new Date(2024, 0, i + 1)
  }));

  beforeEach(() => {
    vi.mock("../../../lib/hooks/useInterviews", () => ({
      useInterviews: () => ({
        data: mockInterviews,
        isLoading: false,
        totalCount: mockInterviews.length
      })
    }));
  });

  it("renders interview list with virtual scroll", async () => {
    const onSelectMock = vi.fn();
    const onStatusChangeMock = vi.fn();

    renderWithProviders(
      <InterviewList
        filters={{}}
        pagination={{
          page: 1,
          pageSize: 20,
          sortBy: "scheduled_at",
          sortDirection: "desc"
        }}
        onInterviewSelect={onSelectMock}
        onStatusChange={onStatusChangeMock}
      />
    );

    // Verify list rendering
    expect(screen.getAllByRole("row")).toHaveLength(mockInterviews.length);

    // Test interview selection
    const firstInterview = screen.getAllByRole("row")[0];
    await userEvent.click(firstInterview);
    expect(onSelectMock).toHaveBeenCalledWith(mockInterviews[0]);

    // Test status change
    const statusSelect = within(firstInterview).getByRole("combobox");
    await userEvent.selectOptions(statusSelect, InterviewStatus.COMPLETED);
    expect(onStatusChangeMock).toHaveBeenCalledWith(
      mockInterviews[0].id,
      InterviewStatus.COMPLETED
    );
  });

  it("handles loading and error states", () => {
    vi.mocked(useInterviews).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      totalCount: 0
    });

    const { rerender } = renderWithProviders(
      <InterviewList
        filters={{}}
        pagination={{
          page: 1,
          pageSize: 20,
          sortBy: "scheduled_at",
          sortDirection: "desc"
        }}
        onInterviewSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    // Test error state
    vi.mocked(useInterviews).mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("Failed to load interviews"),
      totalCount: 0
    });

    rerender(
      <InterviewList
        filters={{}}
        pagination={{
          page: 1,
          pageSize: 20,
          sortBy: "scheduled_at",
          sortDirection: "desc"
        }}
        onInterviewSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Failed to load interviews/i)).toBeInTheDocument();
  });
});