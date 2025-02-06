import * as React from "react"; // ^18.0.0
import { ErrorBoundary } from "react-error-boundary"; // ^4.0.0
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@shadcn/ui"; // ^0.1.0

import KanbanBoard from "../../components/pipeline/KanbanBoard";
import ListView from "../../components/pipeline/ListView";
import PageHeader from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";
import { useCandidates } from "../../lib/hooks/useCandidates";
import { cn } from "../../lib/utils";
import { ApplicationStatus, CandidateStatus } from "../../types/candidates";

// View type enum
type ViewType = "kanban" | "list";

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-8 text-center" role="alert">
    <h2 className="text-lg font-semibold text-destructive mb-4">Error Loading Pipeline</h2>
    <p className="text-muted-foreground mb-4">{error.message}</p>
    <Button onClick={resetErrorBoundary} variant="outline">
      Try Again
    </Button>
  </div>
);

const PipelinePage: React.FC = () => {
  // State management
  const [viewType, setViewType] = React.useState<ViewType>(() => {
    return (localStorage.getItem("pipeline-view") as ViewType) || "kanban";
  });

  // Fetch candidates data with real-time updates
  const {
    candidates,
    isLoading,
    error,
    updateCandidate,
    searchParams,
    updateSearchParams,
  } = useCandidates({
    initialSearchParams: {
      status: [CandidateStatus.ACTIVE],
      page: 1,
      limit: 50,
    },
  });

  // Group candidates by application status
  const candidatesByStage = React.useMemo(() => {
    const stages = Object.values(ApplicationStatus).reduce(
      (acc, status) => ({ ...acc, [status]: [] }),
      {} as Record<ApplicationStatus, typeof candidates>
    );

    return candidates.reduce((acc, candidate) => {
      const status = candidate.status as ApplicationStatus;
      acc[status] = [...(acc[status] || []), candidate];
      return acc;
    }, stages);
  }, [candidates]);

  // Sort configuration for list view
  const [sortConfig, setSortConfig] = React.useState({
    column: "last_active",
    direction: "desc" as "asc" | "desc",
  });

  // Event Handlers
  const handleViewChange = React.useCallback((newView: ViewType) => {
    setViewType(newView);
    localStorage.setItem("pipeline-view", newView);
  }, []);

  const handleCandidateMove = React.useCallback(
    async (candidateId: string, source: ApplicationStatus, destination: ApplicationStatus) => {
      try {
        await updateCandidate(candidateId, {
          status: destination,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to move candidate:", error);
        throw error;
      }
    },
    [updateCandidate]
  );

  const handleCandidateClick = React.useCallback((candidate: typeof candidates[0]) => {
    // Navigate to candidate details (implementation depends on routing solution)
    console.log("Navigate to candidate:", candidate.id);
  }, []);

  const handleSort = React.useCallback((column: string) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  // ARIA live region for status updates
  const statusRef = React.useRef<HTMLDivElement>(null);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Status announcer for screen readers */}
        <div
          ref={statusRef}
          className="sr-only"
          role="status"
          aria-live="polite"
        />

        {/* Page Header */}
        <PageHeader
          title="Recruitment Pipeline"
          description="Manage and track candidates through the recruitment process"
          actions={
            <div className="flex items-center gap-4">
              <Tabs
                value={viewType}
                onValueChange={(value) => handleViewChange(value as ViewType)}
                className="w-[400px]"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
                  <TabsTrigger value="list">List View</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          }
        />

        {/* Main Content */}
        <div className="mt-6">
          {viewType === "kanban" ? (
            <KanbanBoard
              candidatesByStage={candidatesByStage}
              onCandidateMove={handleCandidateMove}
              onCandidateClick={handleCandidateClick}
              isLoading={isLoading}
              className="h-[calc(100vh-200px)]"
            />
          ) : (
            <ListView
              candidates={candidates}
              onCandidateClick={handleCandidateClick}
              onStatusChange={handleCandidateMove}
              isLoading={isLoading}
              sortConfig={sortConfig}
              onSort={handleSort}
            />
          )}
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div
            className={cn(
              "absolute inset-0 bg-background/50 flex items-center justify-center",
              "backdrop-blur-sm transition-all duration-200"
            )}
            role="progressbar"
            aria-busy="true"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default PipelinePage;