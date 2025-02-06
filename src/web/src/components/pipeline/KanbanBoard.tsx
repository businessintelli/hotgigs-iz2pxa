import * as React from "react"; // ^18.0.0
import { DragDropContext, DropResult, DragStart } from "@hello-pangea/dnd"; // ^16.3.0
import { cn } from "../../lib/utils";
import KanbanColumn from "./KanbanColumn";
import { ApplicationStatus, Candidate } from "../../types/candidates";

interface KanbanBoardProps {
  candidatesByStage: Record<ApplicationStatus, Candidate[]>;
  onCandidateMove: (
    candidateId: string,
    source: ApplicationStatus,
    destination: ApplicationStatus
  ) => Promise<void>;
  onCandidateClick: (candidate: Candidate) => void;
  className?: string;
  isLoading?: boolean;
  onError?: (error: Error) => void;
  isDragDisabled?: boolean;
}

const KanbanBoard = React.memo(({
  candidatesByStage,
  onCandidateMove,
  onCandidateClick,
  className,
  isLoading,
  onError,
  isDragDisabled = false
}: KanbanBoardProps) => {
  // State for tracking active drag operation
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  
  // Animation frame reference for smooth animations
  const animationFrameRef = React.useRef<number>();
  
  // ARIA live region ref for accessibility announcements
  const liveRegionRef = React.useRef<HTMLDivElement>(null);

  // Cleanup animation frames on unmount
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle drag start
  const handleDragStart = (start: DragStart) => {
    setActiveDragId(start.draggableId);
    
    // Announce drag start for screen readers
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = "Started dragging candidate card";
    }
  };

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    setActiveDragId(null);

    const { source, destination, draggableId } = result;

    // Return if dropped outside or in same position
    if (!destination || 
        (source.droppableId === destination.droppableId && 
         source.index === destination.index)) {
      return;
    }

    try {
      // Convert droppableIds to ApplicationStatus
      const sourceStatus = source.droppableId as ApplicationStatus;
      const destinationStatus = destination.droppableId as ApplicationStatus;

      // Announce status change for screen readers
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Moved candidate to ${destinationStatus.toLowerCase().replace('_', ' ')}`;
      }

      // Call the move handler
      await onCandidateMove(draggableId, sourceStatus, destinationStatus);
    } catch (error) {
      if (error instanceof Error) {
        onError?.(error);
        
        // Announce error for screen readers
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = "Error moving candidate. Please try again.";
        }
      }
    }
  };

  // Map of stage titles for display
  const stageTitles: Record<ApplicationStatus, string> = {
    [ApplicationStatus.APPLIED]: "Applied",
    [ApplicationStatus.SCREENING]: "Screening",
    [ApplicationStatus.INTERVIEWING]: "Interviewing",
    [ApplicationStatus.OFFER_PENDING]: "Offer Pending",
    [ApplicationStatus.OFFER_ACCEPTED]: "Offer Accepted",
    [ApplicationStatus.OFFER_DECLINED]: "Offer Declined",
    [ApplicationStatus.REJECTED]: "Rejected"
  };

  return (
    <div 
      className={cn(
        "relative flex gap-4 h-full overflow-x-auto pb-4",
        "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600",
        className
      )}
      role="application"
      aria-label="Recruitment pipeline board"
    >
      {/* ARIA live region for announcements */}
      <div
        ref={liveRegionRef}
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />

      <DragDropContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Render columns for active stages */}
        {Object.entries(candidatesByStage)
          .filter(([status]) => status !== ApplicationStatus.OFFER_DECLINED && 
                              status !== ApplicationStatus.REJECTED)
          .map(([status, candidates]) => (
            <KanbanColumn
              key={status}
              id={status}
              title={stageTitles[status as ApplicationStatus]}
              candidates={candidates}
              onCandidateClick={onCandidateClick}
              isLoading={isLoading}
              onError={onError}
              className={cn(
                activeDragId && "transition-colors duration-200",
                activeDragId && status === "OFFER_ACCEPTED" && 
                "bg-green-50 dark:bg-green-900/10"
              )}
            />
          ))}
      </DragDropContext>

      {/* Archive Columns */}
      <div className="flex gap-4 min-w-max">
        {Object.entries(candidatesByStage)
          .filter(([status]) => status === ApplicationStatus.OFFER_DECLINED || 
                              status === ApplicationStatus.REJECTED)
          .map(([status, candidates]) => (
            <KanbanColumn
              key={status}
              id={status}
              title={stageTitles[status as ApplicationStatus]}
              candidates={candidates}
              onCandidateClick={onCandidateClick}
              isLoading={isLoading}
              onError={onError}
              className="opacity-75"
            />
          ))}
      </div>
    </div>
  );
});

KanbanBoard.displayName = "KanbanBoard";

export default KanbanBoard;