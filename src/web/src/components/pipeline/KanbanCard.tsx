import * as React from "react"; // ^18.0.0
import { DraggableProvided } from "react-beautiful-dnd"; // ^13.1.1
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import type { Candidate } from "../../types/candidates";

interface KanbanCardProps {
  candidate: Candidate;
  draggableProps: DraggableProvided;
  onClick: (candidate: Candidate) => void;
  isDragging: boolean;
}

const KanbanCard = React.memo(({ 
  candidate, 
  draggableProps, 
  onClick, 
  isDragging 
}: KanbanCardProps) => {
  const handleClick = React.useCallback((
    event: React.MouseEvent | React.KeyboardEvent
  ) => {
    event.preventDefault();
    onClick(candidate);
  }, [candidate, onClick]);

  const handleKeyDown = React.useCallback((
    event: React.KeyboardEvent
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(candidate);
    }
  }, [candidate, onClick]);

  return (
    <div
      ref={draggableProps.innerRef}
      {...draggableProps.draggableProps}
      {...draggableProps.dragHandleProps}
      className={cn(
        "transition-all duration-200",
        isDragging && "rotate-2 scale-105",
      )}
    >
      <Card
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "cursor-pointer hover:shadow-md transition-shadow",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          isDragging && "shadow-lg"
        )}
        role="button"
        tabIndex={0}
        aria-label={`Candidate: ${candidate.full_name}`}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-3">
            {candidate.avatar_url && (
              <img
                src={candidate.avatar_url}
                alt={candidate.full_name}
                className="w-8 h-8 rounded-full"
                loading="lazy"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                {candidate.full_name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {candidate.role}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={
                candidate.status === 'ACTIVE' ? 'success' :
                candidate.status === 'PASSIVE' ? 'warning' :
                'secondary'
              }
              className="text-xs"
            >
              {candidate.status.toLowerCase()}
            </Badge>
            {candidate.experience_level && (
              <Badge variant="outline" className="text-xs">
                {candidate.experience_level}
              </Badge>
            )}
          </div>
          {candidate.skills?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {candidate.skills.slice(0, 3).map((skill) => (
                <span
                  key={skill}
                  className="inline-flex text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full"
                >
                  {skill}
                </span>
              ))}
              {candidate.skills.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{candidate.skills.length - 3}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

KanbanCard.displayName = "KanbanCard";

export default KanbanCard;