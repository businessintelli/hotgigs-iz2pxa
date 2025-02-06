"use client";

import * as React from "react";
import { useForm } from "react-hook-form"; // ^7.0.0
import { zodResolver } from "@hookform/resolvers/zod"; // ^3.0.0
import { useToast } from "@/components/ui/use-toast"; // ^1.0.0
import { Calendar } from "../ui/calendar";
import { useScheduleInterview, useInterviewSubscription } from "../../lib/hooks/useInterviews";
import { 
  InterviewType, 
  InterviewMode, 
  InterviewScheduleParams,
  interviewScheduleSchema 
} from "../../types/interviews";
import { cn } from "../../lib/utils";

interface InterviewSchedulerProps {
  candidateId: string;
  jobId: string;
  onScheduled?: (interview: InterviewScheduleParams) => void;
  className?: string;
  timezone?: string;
  enableRealtime?: boolean;
}

export const InterviewScheduler = React.forwardRef<HTMLFormElement, InterviewSchedulerProps>(
  ({ candidateId, jobId, onScheduled, className, timezone = "UTC", enableRealtime = true }, ref) => {
    const { toast } = useToast();
    const { scheduleInterview, isScheduling, error: schedulingError } = useScheduleInterview();

    // Form setup with zod validation
    const form = useForm<InterviewScheduleParams>({
      resolver: zodResolver(interviewScheduleSchema),
      defaultValues: {
        candidate_id: candidateId,
        job_id: jobId,
        type: InterviewType.TECHNICAL,
        mode: InterviewMode.VIDEO,
        scheduled_at: new Date(),
        duration_minutes: 60,
        interviewer_ids: [],
        location: "",
        notes: ""
      }
    });

    // Business hours validation (9 AM - 5 PM, Mon-Fri)
    const isBusinessHours = (date: Date): boolean => {
      const hours = date.getHours();
      const dayOfWeek = date.getDay();
      return hours >= 9 && hours < 17 && dayOfWeek >= 1 && dayOfWeek <= 5;
    };

    // Handle date selection with validation
    const handleDateSelect = React.useCallback((date: Date | undefined) => {
      if (!date) return;

      if (!isBusinessHours(date)) {
        toast({
          title: "Invalid Time Selection",
          description: "Please select a time during business hours (9 AM - 5 PM, Mon-Fri)",
          variant: "destructive"
        });
        return;
      }

      form.setValue("scheduled_at", date, { shouldValidate: true });
    }, [form, toast]);

    // Handle form submission
    const onSubmit = async (data: InterviewScheduleParams) => {
      try {
        const interview = await scheduleInterview(data);
        
        toast({
          title: "Interview Scheduled",
          description: "The interview has been successfully scheduled.",
          variant: "success"
        });

        onScheduled?.(interview);
        form.reset();
      } catch (error) {
        toast({
          title: "Scheduling Failed",
          description: error instanceof Error ? error.message : "Failed to schedule interview",
          variant: "destructive"
        });
      }
    };

    // Subscribe to real-time updates if enabled
    React.useEffect(() => {
      if (!enableRealtime) return;

      const subscription = useInterviewSubscription((update) => {
        if (update.candidate_id === candidateId && update.job_id === jobId) {
          toast({
            title: "Interview Update",
            description: "Interview details have been updated.",
            variant: "info"
          });
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    }, [candidateId, jobId, enableRealtime, toast]);

    return (
      <form
        ref={ref}
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "space-y-6 p-6",
          "bg-white dark:bg-gray-800",
          "rounded-lg border border-gray-200 dark:border-gray-700",
          "shadow-sm",
          className
        )}
      >
        {/* Interview Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Interview Type
          </label>
          <select
            {...form.register("type")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          >
            {Object.values(InterviewType).map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
          {form.formState.errors.type && (
            <p className="text-sm text-red-500">{form.formState.errors.type.message}</p>
          )}
        </div>

        {/* Interview Mode Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Interview Mode
          </label>
          <select
            {...form.register("mode")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          >
            {Object.values(InterviewMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode.replace("_", " ")}
              </option>
            ))}
          </select>
          {form.formState.errors.mode && (
            <p className="text-sm text-red-500">{form.formState.errors.mode.message}</p>
          )}
        </div>

        {/* Date/Time Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Date and Time ({timezone})
          </label>
          <Calendar
            mode="single"
            selected={form.getValues("scheduled_at")}
            onSelect={handleDateSelect}
            className="rounded-md border"
            disabled={isScheduling}
          />
          {form.formState.errors.scheduled_at && (
            <p className="text-sm text-red-500">{form.formState.errors.scheduled_at.message}</p>
          )}
        </div>

        {/* Duration Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Duration (minutes)
          </label>
          <select
            {...form.register("duration_minutes", { valueAsNumber: true })}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
          >
            {[30, 45, 60, 90, 120].map((duration) => (
              <option key={duration} value={duration}>
                {duration} minutes
              </option>
            ))}
          </select>
          {form.formState.errors.duration_minutes && (
            <p className="text-sm text-red-500">{form.formState.errors.duration_minutes.message}</p>
          )}
        </div>

        {/* Location/Link */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Location or Meeting Link
          </label>
          <input
            type="text"
            {...form.register("location")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
            placeholder="Enter location or meeting link"
          />
          {form.formState.errors.location && (
            <p className="text-sm text-red-500">{form.formState.errors.location.message}</p>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Additional Notes
          </label>
          <textarea
            {...form.register("notes")}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
            rows={3}
            placeholder="Enter any additional notes or instructions"
          />
          {form.formState.errors.notes && (
            <p className="text-sm text-red-500">{form.formState.errors.notes.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isScheduling}
          className={cn(
            "w-full rounded-md px-4 py-2 text-sm font-medium text-white",
            "bg-primary hover:bg-primary/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isScheduling ? "Scheduling..." : "Schedule Interview"}
        </button>

        {/* Error Display */}
        {schedulingError && (
          <p className="text-sm text-red-500 mt-2">
            {schedulingError instanceof Error ? schedulingError.message : "An error occurred"}
          </p>
        )}
      </form>
    );
  }
);

InterviewScheduler.displayName = "InterviewScheduler";