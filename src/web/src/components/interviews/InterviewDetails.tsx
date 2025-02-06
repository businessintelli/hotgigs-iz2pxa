import * as React from "react"; // ^18.0.0
import { format } from "date-fns"; // ^2.30.0
import {
  Interview,
  InterviewType,
  InterviewStatus,
  InterviewScheduleParams
} from "../../types/interviews";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from "../ui/card";
import { useInterview, useUpdateInterview, useCancelInterview } from "../../lib/hooks/useInterviews";
import { cn } from "../../lib/utils";

interface InterviewDetailsProps {
  interviewId: string;
  className?: string;
}

const InterviewDetails: React.FC<InterviewDetailsProps> = ({
  interviewId,
  className
}) => {
  // Fetch interview data with real-time updates
  const { data: interview, isLoading, error } = useInterview(interviewId);
  const updateInterview = useUpdateInterview();
  const cancelInterview = useCancelInterview();

  // Interview status badge styles
  const getStatusBadgeClass = (status: InterviewStatus): string => {
    const baseClasses = "px-2 py-1 rounded-full text-sm font-medium";
    const statusClasses = {
      [InterviewStatus.SCHEDULED]: "bg-blue-100 text-blue-800",
      [InterviewStatus.RESCHEDULED]: "bg-yellow-100 text-yellow-800",
      [InterviewStatus.CANCELLED]: "bg-red-100 text-red-800",
      [InterviewStatus.COMPLETED]: "bg-green-100 text-green-800",
      [InterviewStatus.NO_SHOW]: "bg-gray-100 text-gray-800"
    };
    return cn(baseClasses, statusClasses[status]);
  };

  // Interview type badge styles
  const getTypeBadgeClass = (type: InterviewType): string => {
    const baseClasses = "px-2 py-1 rounded-full text-sm font-medium";
    const typeClasses = {
      [InterviewType.TECHNICAL]: "bg-purple-100 text-purple-800",
      [InterviewType.HR]: "bg-teal-100 text-teal-800",
      [InterviewType.BEHAVIORAL]: "bg-indigo-100 text-indigo-800",
      [InterviewType.SYSTEM_DESIGN]: "bg-pink-100 text-pink-800",
      [InterviewType.FINAL]: "bg-orange-100 text-orange-800"
    };
    return cn(baseClasses, typeClasses[type]);
  };

  // Calendar sync status indicator
  const getCalendarSyncStatus = (interview: Interview): React.ReactNode => {
    if (!interview.calendar_event_id) {
      return (
        <span className="text-yellow-600 text-sm">
          ⚠️ Not synced with calendar
        </span>
      );
    }
    return (
      <span className="text-green-600 text-sm">
        ✓ Synced with calendar
      </span>
    );
  };

  // Handle interview rescheduling
  const handleReschedule = async (params: InterviewScheduleParams) => {
    try {
      await updateInterview.mutateAsync({
        id: interviewId,
        ...params,
        status: InterviewStatus.RESCHEDULED
      });
    } catch (error) {
      console.error("Failed to reschedule interview:", error);
      throw error;
    }
  };

  // Handle interview cancellation
  const handleCancel = async () => {
    try {
      await cancelInterview.mutateAsync(interviewId);
    } catch (error) {
      console.error("Failed to cancel interview:", error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error || !interview) {
    return (
      <Card className={cn("bg-red-50", className)}>
        <CardContent className="p-6">
          <p className="text-red-600">
            Error loading interview details. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">
            Interview Details
          </CardTitle>
          <span className={getStatusBadgeClass(interview.status)}>
            {interview.status}
          </span>
        </div>
        <span className={getTypeBadgeClass(interview.type)}>
          {interview.type}
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Schedule Information */}
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Schedule</h3>
          <p className="text-gray-600">
            {format(new Date(interview.scheduled_at), "PPP 'at' p")}
          </p>
          {getCalendarSyncStatus(interview)}
        </div>

        {/* Candidate Information */}
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Candidate</h3>
          <p className="text-gray-600">
            {interview.candidate_id}
          </p>
        </div>

        {/* Interview Status Actions */}
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700">Actions</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => handleReschedule(interview)}
              disabled={interview.status === InterviewStatus.CANCELLED}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium",
                "bg-blue-600 text-white hover:bg-blue-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Reschedule
            </button>
            <button
              onClick={handleCancel}
              disabled={interview.status === InterviewStatus.CANCELLED}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium",
                "bg-red-600 text-white hover:bg-red-700",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-gray-50">
        <p className="text-sm text-gray-500">
          Last updated: {format(new Date(interview.updated_at), "PPP")}
        </p>
      </CardFooter>
    </Card>
  );
};

export default InterviewDetails;