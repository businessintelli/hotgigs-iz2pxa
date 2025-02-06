import * as React from "react"; // ^18.0.0
import { useParams } from "react-router-dom"; // ^6.0.0
import { withErrorBoundary } from "react-error-boundary"; // ^4.0.0
import { debounce } from "lodash"; // ^4.17.21
import PageHeader from "../../components/layout/PageHeader";
import HotlistForm from "../../components/hotlists/HotlistForm";
import { useHotlists } from "../../lib/hooks/useHotlists";
import { useToast } from "../../lib/hooks/useToast";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { 
  Hotlist, 
  HotlistVisibility, 
  HotlistAuditAction,
  getHotlistPermissions 
} from "../../types/hotlists";

// Error boundary fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 text-center" role="alert">
    <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
    <p className="mt-2 text-sm text-gray-600">{error.message}</p>
    <Button 
      variant="secondary" 
      className="mt-4" 
      onClick={resetErrorBoundary}
    >
      Try again
    </Button>
  </div>
);

const HotlistDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [csrfToken] = React.useState(() => crypto.randomUUID());

  // Initialize hotlist data management with real-time updates
  const {
    data: hotlists,
    updateHotlist,
    deleteHotlist,
    isLoading,
    error,
    isRealTimeEnabled
  } = useHotlists({
    searchParams: {
      query: "",
      page: 1,
      limit: 1,
      visibility: [HotlistVisibility.PRIVATE, HotlistVisibility.TEAM, HotlistVisibility.PUBLIC],
      tags: [],
      owner_id: "",
      include_archived: false,
      modified_after: new Date(0),
      modified_before: new Date(),
      min_members: 0
    },
    enableRealtime: true
  });

  // Get current hotlist and permissions
  const hotlist = hotlists.find(h => h.id === id);
  const permissions = hotlist ? getHotlistPermissions(hotlist) : null;

  // Handle hotlist update with debouncing and optimistic updates
  const handleUpdateHotlist = React.useCallback(
    debounce(async (data: Partial<Hotlist>) => {
      if (!hotlist || !permissions?.can_edit) return;

      try {
        await updateHotlist.mutateAsync({
          id: hotlist.id,
          ...data
        });

        toast.success({
          title: "Hotlist updated",
          description: "Changes have been saved successfully"
        });
        setIsEditing(false);
      } catch (err) {
        toast.error({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Failed to update hotlist"
        });
      }
    }, 500),
    [hotlist, permissions, updateHotlist, toast]
  );

  // Handle hotlist deletion with confirmation
  const handleDeleteHotlist = React.useCallback(async () => {
    if (!hotlist || !permissions?.can_delete) return;

    const confirmed = window.confirm("Are you sure you want to delete this hotlist? This action cannot be undone.");
    if (!confirmed) return;

    try {
      await deleteHotlist.mutateAsync(hotlist.id);
      toast.success({
        title: "Hotlist deleted",
        description: "The hotlist has been permanently removed"
      });
      // Navigation will be handled by real-time subscription
    } catch (err) {
      toast.error({
        title: "Deletion failed",
        description: err instanceof Error ? err.message : "Failed to delete hotlist"
      });
    }
  }, [hotlist, permissions, deleteHotlist, toast]);

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-8 w-1/3 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-1/2 bg-gray-200 rounded mb-8" />
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !hotlist) {
    return (
      <div className="p-6 text-center" role="alert">
        <h2 className="text-lg font-semibold text-red-600">
          {error ? "Error loading hotlist" : "Hotlist not found"}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {error?.message || "The requested hotlist could not be found"}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title={hotlist.name}
        description={hotlist.description}
        status={hotlist.is_archived ? "Archived" : "Active"}
        actions={
          permissions?.can_edit ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                disabled={!permissions.can_edit}
              >
                {isEditing ? "Cancel" : "Edit"}
              </Button>
              {permissions.can_delete && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteHotlist}
                  disabled={deleteHotlist.isLoading}
                >
                  Delete
                </Button>
              )}
            </div>
          ) : null
        }
      />

      <div className="mt-6">
        {/* Hotlist metadata */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Badge variant="secondary">
            {hotlist.visibility.toLowerCase()}
          </Badge>
          <Badge variant="outline">
            {hotlist.member_count} members
          </Badge>
          {hotlist.tags.map(tag => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Real-time status indicator */}
        {isRealTimeEnabled && (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Real-time updates enabled
          </div>
        )}

        {/* Edit form */}
        {isEditing ? (
          <HotlistForm
            initialData={hotlist}
            onSubmit={handleUpdateHotlist}
            onCancel={() => setIsEditing(false)}
            isSubmitting={updateHotlist.isLoading}
            csrfToken={csrfToken}
          />
        ) : (
          <div className="prose max-w-none">
            {/* Hotlist details view */}
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Description</h3>
              <p className="text-gray-700">{hotlist.description}</p>
              
              <h3 className="text-lg font-semibold mt-6 mb-4">Details</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(hotlist.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(hotlist.updated_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Activity</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(hotlist.last_activity_at).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Collaborators</dt>
                  <dd className="text-sm text-gray-900">
                    {hotlist.collaborator_count}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export with error boundary wrapper
export default withErrorBoundary(HotlistDetailsPage, {
  FallbackComponent: ErrorFallback,
  onReset: () => {
    // Reload the page on reset
    window.location.reload();
  }
});