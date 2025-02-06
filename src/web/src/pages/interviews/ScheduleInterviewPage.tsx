"use client";

import * as React from "react"; // ^18.0.0
import { useParams, useNavigate } from "@remix-run/react"; // ^2.0.0
import { useQuery } from "@tanstack/react-query"; // ^4.0.0
import { toast } from "react-toastify"; // ^9.0.0
import { InterviewScheduler } from "../../components/interviews/InterviewScheduler";
import PageHeader from "../../components/layout/PageHeader";
import { supabase } from "../../lib/supabase";
import { CACHE_KEYS } from "../../config/constants";
import { InterviewScheduleParams } from "../../types/interviews";
import { cn } from "../../lib/utils";

interface ScheduleInterviewPageProps {}

const ScheduleInterviewPage = React.memo<ScheduleInterviewPageProps>(() => {
  const { candidateId, jobId } = useParams<{ candidateId: string; jobId: string }>();
  const navigate = useNavigate();

  // Fetch candidate and job details for the header
  const { data: candidateData, isLoading: isLoadingCandidate } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('full_name, email')
        .eq('id', candidateId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const { data: jobData, isLoading: isLoadingJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('title, department')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });

  // Handle successful interview scheduling
  const handleScheduleSuccess = React.useCallback((details: InterviewScheduleParams) => {
    toast.success("Interview scheduled successfully!", {
      position: "top-right",
      autoClose: 5000,
    });

    // Invalidate relevant queries
    supabase.channel('interview-updates').send({
      type: 'broadcast',
      event: 'interview_scheduled',
      payload: {
        candidate_id: candidateId,
        job_id: jobId,
        scheduled_at: details.scheduled_at,
      },
    });

    // Navigate back to interviews list
    navigate('/interviews');
  }, [candidateId, jobId, navigate]);

  // Handle scheduling errors
  const handleScheduleError = React.useCallback((error: Error) => {
    toast.error(error.message || "Failed to schedule interview", {
      position: "top-right",
      autoClose: 5000,
    });
    console.error("Interview scheduling error:", error);
  }, []);

  // Loading state
  if (isLoadingCandidate || isLoadingJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state if data is missing
  if (!candidateData || !jobData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-semibold text-destructive">Error Loading Data</h2>
        <p className="text-muted-foreground mt-2">Unable to load required information</p>
        <button
          onClick={() => navigate(-1)}
          className={cn(
            "mt-4 px-4 py-2 rounded-md",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors"
          )}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PageHeader
        title="Schedule Interview"
        description={`Schedule an interview with ${candidateData.full_name} for ${jobData.title}`}
        className="mb-6"
      />

      <div className="bg-card rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Candidate</h3>
              <p className="mt-1 text-foreground">{candidateData.full_name}</p>
              <p className="text-sm text-muted-foreground">{candidateData.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Position</h3>
              <p className="mt-1 text-foreground">{jobData.title}</p>
              <p className="text-sm text-muted-foreground">{jobData.department}</p>
            </div>
          </div>
        </div>

        <InterviewScheduler
          candidateId={candidateId!}
          jobId={jobId!}
          onScheduled={handleScheduleSuccess}
          onError={handleScheduleError}
          className="p-6"
        />
      </div>
    </div>
  );
});

ScheduleInterviewPage.displayName = "ScheduleInterviewPage";

export default ScheduleInterviewPage;