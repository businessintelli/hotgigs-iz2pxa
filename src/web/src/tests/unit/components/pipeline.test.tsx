import * as React from "react"; // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"; // ^14.0.0
import { vi } from "vitest"; // ^0.34.0
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"; // ^16.3.0

import KanbanBoard from "../../components/pipeline/KanbanBoard";
import KanbanColumn from "../../components/pipeline/KanbanColumn";
import KanbanCard from "../../components/pipeline/KanbanCard";
import ListView from "../../components/pipeline/ListView";
import { ApplicationStatus, CandidateStatus } from "../../types/candidates";

// Test utilities
const renderWithDragDrop = (ui: React.ReactElement) => {
  return render(
    <DragDropContext onDragEnd={() => {}}>
      {ui}
    </DragDropContext>
  );
};

const createMockDragEvent = (
  sourceId: string,
  destinationId: string,
  draggableId: string
) => ({
  source: { droppableId: sourceId, index: 0 },
  destination: { droppableId: destinationId, index: 0 },
  draggableId,
  type: "DEFAULT"
});

// Mock data
const mockCandidates = [
  {
    id: "1",
    full_name: "John Doe",
    email: "john@example.com",
    status: CandidateStatus.ACTIVE,
    experience_level: "Senior",
    skills: ["React", "TypeScript", "Node.js"],
    last_active: new Date(),
    role: "Frontend Developer",
    avatar_url: "https://example.com/avatar.jpg",
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: "2",
    full_name: "Jane Smith",
    email: "jane@example.com",
    status: CandidateStatus.PASSIVE,
    experience_level: "Mid",
    skills: ["Python", "Django", "PostgreSQL"],
    last_active: new Date(),
    role: "Backend Developer",
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Mock handlers
const mockHandlers = {
  onCandidateMove: vi.fn(),
  onCandidateClick: vi.fn(),
  onStatusChange: vi.fn(),
  onError: vi.fn()
};

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
});
window.IntersectionObserver = mockIntersectionObserver;

describe("KanbanBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all columns with correct candidates", () => {
    const candidatesByStage = {
      [ApplicationStatus.APPLIED]: [mockCandidates[0]],
      [ApplicationStatus.SCREENING]: [mockCandidates[1]],
      [ApplicationStatus.INTERVIEWING]: [],
      [ApplicationStatus.OFFER_PENDING]: [],
      [ApplicationStatus.OFFER_ACCEPTED]: [],
      [ApplicationStatus.OFFER_DECLINED]: [],
      [ApplicationStatus.REJECTED]: []
    };

    renderWithDragDrop(
      <KanbanBoard
        candidatesByStage={candidatesByStage}
        onCandidateMove={mockHandlers.onCandidateMove}
        onCandidateClick={mockHandlers.onCandidateClick}
        onError={mockHandlers.onError}
      />
    );

    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("handles drag and drop between columns", async () => {
    const candidatesByStage = {
      [ApplicationStatus.APPLIED]: [mockCandidates[0]],
      [ApplicationStatus.SCREENING]: [],
      [ApplicationStatus.INTERVIEWING]: [],
      [ApplicationStatus.OFFER_PENDING]: [],
      [ApplicationStatus.OFFER_ACCEPTED]: [],
      [ApplicationStatus.OFFER_DECLINED]: [],
      [ApplicationStatus.REJECTED]: []
    };

    const { container } = renderWithDragDrop(
      <KanbanBoard
        candidatesByStage={candidatesByStage}
        onCandidateMove={mockHandlers.onCandidateMove}
        onCandidateClick={mockHandlers.onCandidateClick}
        onError={mockHandlers.onError}
      />
    );

    const dragEvent = createMockDragEvent(
      ApplicationStatus.APPLIED,
      ApplicationStatus.SCREENING,
      mockCandidates[0].id
    );

    // Simulate drag end
    fireEvent(container, new CustomEvent("dragend", { detail: dragEvent }));

    await waitFor(() => {
      expect(mockHandlers.onCandidateMove).toHaveBeenCalledWith(
        mockCandidates[0].id,
        ApplicationStatus.APPLIED,
        ApplicationStatus.SCREENING
      );
    });
  });

  it("announces drag operations for screen readers", () => {
    const candidatesByStage = {
      [ApplicationStatus.APPLIED]: [mockCandidates[0]],
      [ApplicationStatus.SCREENING]: [],
      [ApplicationStatus.INTERVIEWING]: [],
      [ApplicationStatus.OFFER_PENDING]: [],
      [ApplicationStatus.OFFER_ACCEPTED]: [],
      [ApplicationStatus.OFFER_DECLINED]: [],
      [ApplicationStatus.REJECTED]: []
    };

    renderWithDragDrop(
      <KanbanBoard
        candidatesByStage={candidatesByStage}
        onCandidateMove={mockHandlers.onCandidateMove}
        onCandidateClick={mockHandlers.onCandidateClick}
        onError={mockHandlers.onError}
      />
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });
});

describe("ListView", () => {
  it("renders candidates in a sortable table", () => {
    render(
      <ListView
        candidates={mockCandidates}
        onCandidateClick={mockHandlers.onCandidateClick}
        onStatusChange={mockHandlers.onStatusChange}
        isLoading={false}
        sortConfig={{ column: "full_name", direction: "asc" }}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
  });

  it("handles row click events", async () => {
    render(
      <ListView
        candidates={mockCandidates}
        onCandidateClick={mockHandlers.onCandidateClick}
        onStatusChange={mockHandlers.onStatusChange}
        isLoading={false}
        sortConfig={{ column: "full_name", direction: "asc" }}
        onSort={vi.fn()}
      />
    );

    const row = screen.getByText("John Doe").closest("tr");
    fireEvent.click(row!);

    expect(mockHandlers.onCandidateClick).toHaveBeenCalledWith(mockCandidates[0]);
  });

  it("supports keyboard navigation", () => {
    render(
      <ListView
        candidates={mockCandidates}
        onCandidateClick={mockHandlers.onCandidateClick}
        onStatusChange={mockHandlers.onStatusChange}
        isLoading={false}
        sortConfig={{ column: "full_name", direction: "asc" }}
        onSort={vi.fn()}
      />
    );

    const row = screen.getByText("John Doe").closest("tr");
    fireEvent.keyDown(row!, { key: "Enter" });

    expect(mockHandlers.onCandidateClick).toHaveBeenCalledWith(mockCandidates[0]);
  });

  it("displays loading state correctly", () => {
    render(
      <ListView
        candidates={mockCandidates}
        onCandidateClick={mockHandlers.onCandidateClick}
        onStatusChange={mockHandlers.onStatusChange}
        isLoading={true}
        sortConfig={{ column: "full_name", direction: "asc" }}
        onSort={vi.fn()}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading candidates");
  });
});

describe("KanbanCard", () => {
  it("renders candidate information correctly", () => {
    const draggableProps = {
      draggableId: mockCandidates[0].id,
      index: 0
    };

    render(
      <KanbanCard
        candidate={mockCandidates[0]}
        draggableProps={draggableProps}
        onClick={mockHandlers.onCandidateClick}
        isDragging={false}
      />
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("applies correct styles when dragging", () => {
    const draggableProps = {
      draggableId: mockCandidates[0].id,
      index: 0
    };

    render(
      <KanbanCard
        candidate={mockCandidates[0]}
        draggableProps={draggableProps}
        onClick={mockHandlers.onCandidateClick}
        isDragging={true}
      />
    );

    const card = screen.getByRole("button");
    expect(card).toHaveClass("shadow-lg");
  });
});