import * as React from "react"; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"; // ^14.0.0
import userEvent from "@testing-library/user-event"; // ^14.0.0
import { vi, describe, it, expect, beforeEach } from "vitest"; // ^0.34.0
import { axe, toHaveNoViolations } from "jest-axe"; // ^4.7.0

import PipelinePage from "../../pages/pipeline/PipelinePage";
import { CandidateStatus, ApplicationStatus } from "../../types/candidates";
import { useCandidates } from "../../lib/hooks/useCandidates";

// Mock dependencies
vi.mock("../../lib/hooks/useCandidates");
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({ children }: { children: any }) => children({
    draggableProps: {
      style: {},
    },
    innerRef: null,
  }),
  Draggable: ({ children }: { children: any }) => children({
    draggableProps: {
      style: {},
    },
    dragHandleProps: {},
    innerRef: null,
  }),
}));

// Mock data
const mockCandidates = [
  {
    id: "1",
    full_name: "John Doe",
    email: "john@example.com",
    status: CandidateStatus.ACTIVE,
    experience_level: "Senior",
    skills: ["React", "TypeScript", "Node.js"],
    last_active: new Date().toISOString(),
    application_status: ApplicationStatus.SCREENING,
  },
  {
    id: "2",
    full_name: "Jane Smith",
    email: "jane@example.com",
    status: CandidateStatus.ACTIVE,
    experience_level: "Mid",
    skills: ["Angular", "JavaScript", "Python"],
    last_active: new Date().toISOString(),
    application_status: ApplicationStatus.INTERVIEWING,
  },
];

describe("PipelinePage Integration Tests", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup useCandidates mock
    (useCandidates as jest.Mock).mockReturnValue({
      candidates: mockCandidates,
      isLoading: false,
      error: null,
      updateCandidate: vi.fn(),
      searchParams: {
        status: [CandidateStatus.ACTIVE],
        page: 1,
        limit: 50,
      },
      updateSearchParams: vi.fn(),
    });
  });

  it("should render pipeline page with both view options", async () => {
    render(<PipelinePage />);

    // Verify view toggle buttons
    expect(screen.getByRole("tab", { name: /kanban board/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /list view/i })).toBeInTheDocument();

    // Verify page header
    expect(screen.getByRole("banner")).toHaveTextContent("Recruitment Pipeline");
  });

  it("should handle view switching between Kanban and List views", async () => {
    const user = userEvent.setup();
    render(<PipelinePage />);

    // Default view should be Kanban
    expect(screen.getByRole("application")).toBeInTheDocument();

    // Switch to list view
    await user.click(screen.getByRole("tab", { name: /list view/i }));
    expect(screen.getByRole("table")).toBeInTheDocument();

    // Switch back to Kanban
    await user.click(screen.getByRole("tab", { name: /kanban board/i }));
    expect(screen.getByRole("application")).toBeInTheDocument();
  });

  it("should handle loading states correctly", async () => {
    (useCandidates as jest.Mock).mockReturnValue({
      candidates: [],
      isLoading: true,
      error: null,
      updateCandidate: vi.fn(),
      searchParams: { status: [CandidateStatus.ACTIVE], page: 1, limit: 50 },
      updateSearchParams: vi.fn(),
    });

    render(<PipelinePage />);

    // Verify loading indicator
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Update mock to loaded state
    (useCandidates as jest.Mock).mockReturnValue({
      candidates: mockCandidates,
      isLoading: false,
      error: null,
      updateCandidate: vi.fn(),
      searchParams: { status: [CandidateStatus.ACTIVE], page: 1, limit: 50 },
      updateSearchParams: vi.fn(),
    });

    // Verify content loaded
    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  it("should handle error states appropriately", async () => {
    const error = new Error("Failed to load candidates");
    (useCandidates as jest.Mock).mockReturnValue({
      candidates: [],
      isLoading: false,
      error,
      updateCandidate: vi.fn(),
      searchParams: { status: [CandidateStatus.ACTIVE], page: 1, limit: 50 },
      updateSearchParams: vi.fn(),
    });

    render(<PipelinePage />);

    // Verify error message
    expect(screen.getByRole("alert")).toHaveTextContent("Error Loading Pipeline");
    expect(screen.getByText(error.message)).toBeInTheDocument();

    // Test retry functionality
    const retryButton = screen.getByRole("button", { name: /try again/i });
    await userEvent.click(retryButton);
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("should handle candidate status updates in Kanban view", async () => {
    const updateCandidate = vi.fn();
    (useCandidates as jest.Mock).mockReturnValue({
      candidates: mockCandidates,
      isLoading: false,
      error: null,
      updateCandidate,
      searchParams: { status: [CandidateStatus.ACTIVE], page: 1, limit: 50 },
      updateSearchParams: vi.fn(),
    });

    render(<PipelinePage />);

    // Simulate drag and drop
    const dragEvent = {
      draggableId: "1",
      source: { droppableId: ApplicationStatus.SCREENING },
      destination: { droppableId: ApplicationStatus.INTERVIEWING },
    };

    // Find and trigger drag end
    const board = screen.getByRole("application");
    fireEvent.dragEnd(board, dragEvent);

    // Verify update was called
    expect(updateCandidate).toHaveBeenCalledWith("1", {
      status: ApplicationStatus.INTERVIEWING,
      updated_at: expect.any(String),
    });
  });

  it("should meet accessibility requirements", async () => {
    const { container } = render(<PipelinePage />);

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify keyboard navigation
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("tab", { name: /kanban board/i })).toHaveFocus();

    // Verify ARIA attributes
    expect(screen.getByRole("banner")).toHaveAttribute("aria-label", expect.stringContaining("Page header"));
    expect(screen.getByRole("application")).toHaveAttribute("aria-label", "Recruitment pipeline board");
  });

  it("should handle real-time updates correctly", async () => {
    const updateCandidate = vi.fn();
    render(<PipelinePage />);

    // Simulate real-time update
    const updatedCandidates = [...mockCandidates];
    updatedCandidates[0].application_status = ApplicationStatus.INTERVIEWING;

    (useCandidates as jest.Mock).mockReturnValue({
      candidates: updatedCandidates,
      isLoading: false,
      error: null,
      updateCandidate,
      searchParams: { status: [CandidateStatus.ACTIVE], page: 1, limit: 50 },
      updateSearchParams: vi.fn(),
    });

    // Verify update reflected in UI
    await waitFor(() => {
      const interviewingColumn = screen.getByRole("region", { name: /interviewing column/i });
      expect(within(interviewingColumn).getByText("John Doe")).toBeInTheDocument();
    });
  });

  it("should handle list view sorting and filtering", async () => {
    const user = userEvent.setup();
    render(<PipelinePage />);

    // Switch to list view
    await user.click(screen.getByRole("tab", { name: /list view/i }));

    // Verify sortable columns
    const nameHeader = screen.getByRole("columnheader", { name: /candidate/i });
    await user.click(nameHeader);

    // Verify sort indicators
    expect(nameHeader).toHaveAttribute("aria-sort", "asc");
    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "desc");
  });
});