import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'; // ^4.0.0
import { useDebounce } from 'use-debounce'; // ^9.0.0
import { 
  Job, 
  JobStatus, 
  JobSearchParams, 
  JobFormData, 
  JobUpdatePayload, 
  jobSchema, 
  jobSearchParamsSchema 
} from '../../types/jobs';
import { useToast } from '../hooks/useToast';
import { createPaginatedResponse, ErrorCode } from '../../types/common';

// Constants
const JOB_CACHE_KEY = 'jobs';
const SEARCH_DEBOUNCE_MS = 300;
const MATCH_POLL_INTERVAL = 30000; // 30 seconds
const DEFAULT_PAGE_SIZE = 20;

interface UseJobsConfig {
  retryCount?: number;
  cacheTime?: number;
  staleTime?: number;
}

interface JobMatchResult {
  jobId: string;
  matchScore: number;
  matchedCandidates: number;
  timestamp: Date;
}

/**
 * Advanced hook for comprehensive job management with real-time updates,
 * optimistic updates, and AI-powered candidate matching.
 */
export function useJobs(config: UseJobsConfig = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Initialize WebSocket connection for real-time updates
  const initializeRealTimeUpdates = () => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_REALTIME_URL!);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      queryClient.invalidateQueries([JOB_CACHE_KEY]);
      
      toast.info({
        title: 'Job Updated',
        description: `${update.title} has been updated`
      });
    };

    return () => ws.close();
  };

  // Job Search with Infinite Loading
  const useJobSearch = (searchParams: JobSearchParams) => {
    const [debouncedQuery] = useDebounce(searchParams.query, SEARCH_DEBOUNCE_MS);
    
    return useInfiniteQuery({
      queryKey: [JOB_CACHE_KEY, 'search', debouncedQuery, searchParams],
      queryFn: async ({ pageParam = 1 }) => {
        try {
          // Validate search params
          jobSearchParamsSchema.parse({ ...searchParams, page: pageParam });
          
          const response = await fetch(`/api/jobs/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...searchParams, page: pageParam })
          });

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data = await response.json();
          return createPaginatedResponse<Job>(
            data.jobs,
            data.total,
            { page: pageParam, limit: searchParams.limit || DEFAULT_PAGE_SIZE }
          );
        } catch (error) {
          toast.error({ 
            title: 'Search Failed',
            description: 'Unable to fetch job listings'
          });
          throw error;
        }
      },
      getNextPageParam: (lastPage) => lastPage.has_next ? lastPage.page + 1 : undefined,
      retry: config.retryCount ?? 3,
      cacheTime: config.cacheTime ?? 300000, // 5 minutes
      staleTime: config.staleTime ?? 60000, // 1 minute
    });
  };

  // Create new job with optimistic update
  const createJob = async (jobData: JobFormData): Promise<Job> => {
    try {
      // Validate job data
      jobSchema.parse(jobData);

      const optimisticJob = {
        ...jobData,
        id: crypto.randomUUID(),
        status: JobStatus.DRAFT,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Optimistic update
      queryClient.setQueryData([JOB_CACHE_KEY], (old: Job[] = []) => [
        optimisticJob,
        ...old
      ]);

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      const createdJob = await response.json();
      
      toast.success({
        title: 'Job Created',
        description: 'New job posting has been created successfully'
      });

      return createdJob;
    } catch (error) {
      toast.error({
        title: 'Creation Failed',
        description: 'Unable to create new job posting'
      });
      throw error;
    }
  };

  // Update existing job
  const updateJob = async (jobId: string, updates: JobUpdatePayload): Promise<Job> => {
    try {
      const previousData = queryClient.getQueryData<Job[]>([JOB_CACHE_KEY]);
      
      // Optimistic update
      queryClient.setQueryData([JOB_CACHE_KEY], (old: Job[] = []) =>
        old.map(job => job.id === jobId ? { ...job, ...updates } : job)
      );

      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        // Revert optimistic update
        queryClient.setQueryData([JOB_CACHE_KEY], previousData);
        throw new Error('Failed to update job');
      }

      const updatedJob = await response.json();
      
      toast.success({
        title: 'Job Updated',
        description: 'Job posting has been updated successfully'
      });

      return updatedJob;
    } catch (error) {
      toast.error({
        title: 'Update Failed',
        description: 'Unable to update job posting'
      });
      throw error;
    }
  };

  // Delete job
  const deleteJob = async (jobId: string): Promise<void> => {
    try {
      const previousData = queryClient.getQueryData<Job[]>([JOB_CACHE_KEY]);
      
      // Optimistic update
      queryClient.setQueryData([JOB_CACHE_KEY], (old: Job[] = []) =>
        old.filter(job => job.id !== jobId)
      );

      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        // Revert optimistic update
        queryClient.setQueryData([JOB_CACHE_KEY], previousData);
        throw new Error('Failed to delete job');
      }

      toast.success({
        title: 'Job Deleted',
        description: 'Job posting has been deleted successfully'
      });
    } catch (error) {
      toast.error({
        title: 'Deletion Failed',
        description: 'Unable to delete job posting'
      });
      throw error;
    }
  };

  // AI-powered candidate matching
  const matchCandidates = async (jobId: string): Promise<JobMatchResult> => {
    const loadingToast = toast.info({
      title: 'Matching Candidates',
      description: 'AI is analyzing potential candidates...',
      duration: null
    });

    try {
      const response = await fetch(`/api/jobs/${jobId}/match`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Matching failed');
      }

      const result = await response.json();
      
      toast.success({
        title: 'Matching Complete',
        description: `Found ${result.matchedCandidates} potential candidates`
      });

      return result;
    } catch (error) {
      toast.error({
        title: 'Matching Failed',
        description: 'Unable to complete candidate matching'
      });
      throw error;
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  // Background polling for match scores
  const useMatchScorePolling = (jobId: string) => {
    return useInfiniteQuery({
      queryKey: [JOB_CACHE_KEY, 'matches', jobId],
      queryFn: async () => {
        const response = await fetch(`/api/jobs/${jobId}/match-score`);
        if (!response.ok) throw new Error('Failed to fetch match scores');
        return response.json();
      },
      refetchInterval: MATCH_POLL_INTERVAL,
      enabled: !!jobId
    });
  };

  return {
    useJobSearch,
    createJob,
    updateJob,
    deleteJob,
    matchCandidates,
    useMatchScorePolling,
    initializeRealTimeUpdates
  };
}

export type { UseJobsConfig, JobMatchResult };