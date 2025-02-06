import * as React from "react"; // ^18.0.0
import { Droppable, DroppableProvided } from "@hello-pangea/dnd"; // ^16.3.0
import { cn } from "../../lib/utils";
import KanbanCard from "./KanbanCard";
import type { Candidate } from "../../types/candidates";
import { Card } from "../ui/card";

interface KanbanColumnProps {
  id: string;
  title: string;
  candidates: Candidate[];
  onCandidateClick?: (candidate: Candidate) => void;
  className?: string;
  isLoading?: boolean;
  onError?: (error: Error) => void;
}

const KanbanColumn = React.memo(({
  id,
  title,
  candidates,
  onCandidateClick,
  className,
  isLoading,
  onError
}: KanbanColumnProps) => {
  // Animation frame reference for smooth drag animations
  const animationFrameRef = React.useRef<number>();

  // Error boundary handler
  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Loading state skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 min-w-[300px] h-full p-4",
          className
        )}
        role="region"
        aria-label={`${title} column loading`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <Droppable droppableId={id}>
      {(provided: DroppableProvided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            "flex flex-col gap-4 min-w-[300px] h-full p-4",
            snapshot.isDraggingOver && "bg-gray-50 dark:bg-gray-800/50",
            className
          )}
          role="region"
          aria-label={`${title} column`}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
            <span
              className="text-sm text-gray-500 dark:text-gray-400"
              aria-label={`${candidates.length} candidates`}
            >
              {candidates.length}
            </span>
          </div>

          {/* Candidate Cards */}
          {candidates.length > 0 ? (
            candidates.map((candidate, index) => (
              <KanbanCard
                key={candidate.id}
                candidate={candidate}
                draggableProps={{
                  draggableId: candidate.id,
                  index: index
                }}
                onClick={onCandidateClick}
                isDragging={snapshot.isDraggingOver}
              />
            ))
          ) : (
            // Empty State
            <Card
              className={cn(
                "flex items-center justify-center h-32 border-2 border-dashed",
                "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              )}
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No candidates
              </p>
            </Card>
          )}

          {/* Placeholder for drag and drop */}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
});

KanbanColumn.displayName = "KanbanColumn";

export default KanbanColumn;