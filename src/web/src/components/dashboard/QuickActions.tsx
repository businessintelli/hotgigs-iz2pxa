import * as React from "react";
import { useNavigate } from "react-router-dom"; // ^6.0.0
import { PlusIcon } from "@heroicons/react/24/outline"; // ^2.0.0
import { Button } from "../ui/button";
import { useJobs } from "../../lib/hooks/useJobs";
import { useCandidates } from "../../lib/hooks/useCandidates";
import { useInterviews } from "../../lib/hooks/useInterviews";
import { useAnalytics } from "../../lib/hooks/useAnalytics";

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => Promise<void>;
  isLoading?: boolean;
  testId?: string;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onClick,
  isLoading,
  testId
}) => (
  <Button
    variant="outline"
    size="lg"
    className="flex items-center justify-center gap-2 p-6 h-auto"
    onClick={onClick}
    isLoading={isLoading}
    data-testid={testId}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </Button>
);

export const QuickActions = React.memo(() => {
  const navigate = useNavigate();
  const { createJob } = useJobs();
  const { createCandidate } = useCandidates();
  const { useScheduleInterview } = useInterviews();
  const { trackAction } = useAnalytics();

  const [isLoading, setIsLoading] = React.useState({
    job: false,
    candidate: false,
    interview: false
  });

  // Error boundary for component-level error handling
  const [error, setError] = React.useState<Error | null>(null);

  const handlePostJob = async () => {
    try {
      setIsLoading(prev => ({ ...prev, job: true }));
      await trackAction("quick_action_post_job_click");
      navigate("/jobs/create");
    } catch (err) {
      setError(err as Error);
      console.error("Error navigating to job creation:", err);
    } finally {
      setIsLoading(prev => ({ ...prev, job: false }));
    }
  };

  const handleAddCandidate = async () => {
    try {
      setIsLoading(prev => ({ ...prev, candidate: true }));
      await trackAction("quick_action_add_candidate_click");
      navigate("/candidates/create");
    } catch (err) {
      setError(err as Error);
      console.error("Error navigating to candidate creation:", err);
    } finally {
      setIsLoading(prev => ({ ...prev, candidate: false }));
    }
  };

  const handleScheduleInterview = async () => {
    try {
      setIsLoading(prev => ({ ...prev, interview: true }));
      await trackAction("quick_action_schedule_interview_click");
      navigate("/interviews/schedule");
    } catch (err) {
      setError(err as Error);
      console.error("Error navigating to interview scheduling:", err);
    } finally {
      setIsLoading(prev => ({ ...prev, interview: false }));
    }
  };

  // Reset error state when component unmounts
  React.useEffect(() => {
    return () => {
      setError(null);
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-md">
        <p>Error: {error.message}</p>
        <button 
          onClick={() => setError(null)}
          className="text-sm text-red-700 underline mt-2"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
      role="group"
      aria-label="Quick actions"
    >
      <QuickActionButton
        icon={<PlusIcon className="w-5 h-5" />}
        label="Post New Job"
        onClick={handlePostJob}
        isLoading={isLoading.job}
        testId="quick-action-post-job"
      />
      
      <QuickActionButton
        icon={<PlusIcon className="w-5 h-5" />}
        label="Add Candidate"
        onClick={handleAddCandidate}
        isLoading={isLoading.candidate}
        testId="quick-action-add-candidate"
      />
      
      <QuickActionButton
        icon={<PlusIcon className="w-5 h-5" />}
        label="Schedule Interview"
        onClick={handleScheduleInterview}
        isLoading={isLoading.interview}
        testId="quick-action-schedule-interview"
      />
    </div>
  );
});

QuickActions.displayName = "QuickActions";

export default QuickActions;