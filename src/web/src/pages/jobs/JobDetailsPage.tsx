import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { withErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { useQueryClient } from '@tanstack/react-query'; // ^4.0.0

import type { Job } from '../../types/jobs';
import JobDetails from '../../components/jobs/JobDetails';
import Loading from '../../components/ui/loading';
import Error from '../../components/ui/error';
import { useJobs } from '../../lib/hooks/useJobs';
import { ErrorCode } from '../../types/common';
import { CACHE_KEYS } from '../../config/constants';

/**
 * JobDetailsPage component displays comprehensive information about a job posting
 * with real-time updates, error handling, and accessibility features.
 */
const JobDetailsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const queryClient = useQueryClient();
  const { useJobSearch, initializeRealTimeUpdates } = useJobs();

  // Validate jobId parameter
  if (!jobId) {
    return (
      <Error
        code={ErrorCode.VALIDATION_ERROR}
        message="Invalid job ID provided"
      />
    );
  }

  // Query for job details with error and loading states
  const {
    data: jobData,
    isLoading,
    error,
    refetch
  } = useJobSearch({
    query: '',
    page: 1,
    limit: 1,
    filters: { id: jobId }
  });

  // Initialize real-time updates subscription
  useEffect(() => {
    const cleanup = initializeRealTimeUpdates();

    // Prefetch related data
    queryClient.prefetchQuery([CACHE_KEYS.JOB_LIST, jobId, 'applications']);
    
    return () => {
      cleanup();
    };
  }, [jobId, initializeRealTimeUpdates, queryClient]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading 
          size="lg"
          overlay={false}
          ariaLabel="Loading job details"
        />
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Error
        code={ErrorCode.INTERNAL_ERROR}
        message="Failed to load job details"
        onRetry={() => refetch()}
      />
    );
  }

  // Handle not found state
  const job = jobData?.data[0];
  if (!job) {
    return (
      <Error
        code={ErrorCode.NOT_FOUND}
        message="Job posting not found"
      />
    );
  }

  // Determine if current user is a recruiter (simplified for example)
  const isRecruiter = true; // This should be determined from auth context

  return (
    <main
      className="container mx-auto px-4 py-8"
      role="main"
      aria-labelledby="job-details-title"
    >
      <JobDetails
        isRecruiter={isRecruiter}
      />
    </main>
  );
};

// Wrap with error boundary for component-level error handling
const JobDetailsPageWithErrorBoundary = withErrorBoundary(JobDetailsPage, {
  FallbackComponent: ({ error, resetErrorBoundary }) => (
    <Error
      code={ErrorCode.INTERNAL_ERROR}
      message={error.message}
      onRetry={resetErrorBoundary}
    />
  ),
  onError: (error, info) => {
    // Log error to monitoring service
    console.error('JobDetailsPage Error:', error, info);
  }
});

export default JobDetailsPageWithErrorBoundary;