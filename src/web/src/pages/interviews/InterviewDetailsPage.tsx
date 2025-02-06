import * as React from "react"; // ^18.0.0
import { useParams } from "react-router-dom"; // ^6.0.0
import { useToast } from "@shadcn/ui"; // ^0.1.0

import InterviewDetails from "../../components/interviews/InterviewDetails";
import InterviewFeedback from "../../components/interviews/InterviewFeedback";
import PageHeader from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/button";

import { useInterview, useUpdateInterview, useCancelInterview, useSubmitFeedback } from "../../lib/hooks/useInterviews";
import { InterviewStatus, InterviewScheduleParams, InterviewFeedback as IInterviewFeedback } from "../../types/interviews";
import { ErrorCode } from "../../types/common";

const InterviewDetailsPage: React.FC = () => {
  // Get interview ID from URL params
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Fetch interview data with real-time updates
  const { data: interview, isLoading, error } = useInterview(id!);
  const updateInterview = useUpdateInterview();
  const cancelInterview = useCancelInterview();
  const submitFeedback = useSubmitFeedback();

  // Track calendar sync status
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Handle interview rescheduling
  const handleReschedule = async (params: InterviewScheduleParams) => {
    try {
      setIsSyncing(true);
      await updateInterview.mutateAsync({
        id: id!,
        ...params,
        status: InterviewStatus.RESCHEDULED
      });

      toast({
        title: "Interview Rescheduled",
        description: "Calendar invites have been updated and sent to all participants.",
        variant: "success"
      });
    } catch (error: any) {
      toast({
        title: "Rescheduling Failed",
        description: error.code === ErrorCode.CONFLICT ? 
          "Calendar conflict detected. Please select a different time." :
          "Failed to reschedule interview. Please try again.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle interview cancellation
  const handleCancel = async () => {
    try {
      await cancelInterview.mutateAsync(id!);
      
      toast({
        title: "Interview Cancelled",
        description: "All participants have been notified and calendar events removed.",
        variant: "info"
      });
    } catch (error: any) {
      toast({
        title: "Cancellation Failed",
        description: "Failed to cancel interview. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedback: IInterviewFeedback) => {
    try {
      await submitFeedback.mutateAsync({
        interview_id: id!,
        ...feedback
      });

      toast({
        title: "Feedback Submitted",
        description: "Your interview feedback has been recorded successfully.",
        variant: "success"
      });
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.code === ErrorCode.VALIDATION_ERROR ?
          "Please check all required fields and try again." :
          "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-8" />
        <div className="space-y-4">
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-60 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !interview) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-medium">Error Loading Interview</h2>
          <p className="text-red-600 mt-2">
            {error?.message || "Failed to load interview details. Please try again."}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Interview Details"
        description={`${interview.type} Interview for ${interview.candidate_id}`}
        status={interview.status}
        actions={
          <>
            {interview.status !== InterviewStatus.CANCELLED && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleReschedule(interview)}
                  disabled={isSyncing}
                >
                  Reschedule
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancelInterview.isLoading}
                >
                  Cancel Interview
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        <div className="lg:col-span-2">
          <InterviewDetails
            interviewId={id!}
            className="h-full"
            onStatusChange={handleReschedule}
            onCalendarSync={(synced) => setIsSyncing(synced)}
          />
        </div>

        <div className="lg:col-span-1">
          <InterviewFeedback
            interview_id={id!}
            interviewer_id={interview.interviewer_ids[0]}
            onSubmit={handleFeedbackSubmit}
            initialFeedback={interview.feedback?.[0]}
            isDisabled={interview.status === InterviewStatus.CANCELLED}
            isLoading={submitFeedback.isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default InterviewDetailsPage;