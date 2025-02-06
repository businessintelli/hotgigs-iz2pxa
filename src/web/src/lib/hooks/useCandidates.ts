import { useState, useCallback } from 'react'; // ^18.0.0
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // ^4.0.0
import { useDebounce } from 'use-debounce'; // ^9.0.0

import { 
  createCandidate,
  updateCandidate,
  deleteCandidate,
  searchCandidates,
  matchCandidatesToJob
} from '../api/candidates';

import {
  Candidate,
  CandidateSearchParams,
  CandidateWithMatchScore,
  CandidateFormData
} from '../../types/candidates';

import { CACHE_KEYS, PAGINATION_DEFAULTS } from '../../config/constants';

interface UseCandidatesOptions {
  initialSearchParams?: Partial<CandidateSearchParams>;
  queryConfig?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    retry?: number | boolean;
  };
}

interface DetailedError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}

/**
 * Advanced hook for comprehensive candidate management with secure handling,
 * optimistic updates, and AI-powered matching capabilities
 */
export function useCandidates(options: UseCandidatesOptions = {}) {
  const queryClient = useQueryClient();
  
  // Local state for search parameters
  const [searchParams, setSearchParams] = useState<CandidateSearchParams>({
    query: '',
    status: [],
    skills: [],
    location: '',
    remote_only: false,
    salary_min: 0,
    salary_max: 0,
    industries: [],
    experience_level: '',
    languages: [],
    is_actively_looking: false,
    availability_date: '',
    certifications: [],
    page: PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER,
    limit: PAGINATION_DEFAULTS.PAGE_SIZE,
    ...options.initialSearchParams
  });

  // Debounced search query for performance
  const [debouncedSearchParams] = useDebounce(searchParams, 300);

  // Main candidates query
  const {
    data: candidatesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
    queryFn: () => searchCandidates(debouncedSearchParams),
    ...options.queryConfig,
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    retry: 2
  });

  // Create candidate mutation
  const createMutation = useMutation({
    mutationFn: (data: CandidateFormData) => createCandidate(data),
    onSuccess: (newCandidate) => {
      queryClient.setQueryData<{ candidates: Candidate[]; total: number; page: number }>(
        [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
        (oldData) => {
          if (!oldData) return { candidates: [newCandidate], total: 1, page: 1 };
          return {
            ...oldData,
            candidates: [newCandidate, ...oldData.candidates],
            total: oldData.total + 1
          };
        }
      );
      queryClient.invalidateQueries([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_CANDIDATES]);
    }
  });

  // Update candidate mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CandidateFormData> }) => 
      updateCandidate(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries([CACHE_KEYS.CANDIDATE_LIST]);
      
      const previousData = queryClient.getQueryData<{ candidates: Candidate[]; total: number; page: number }>(
        [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams]
      );

      queryClient.setQueryData<{ candidates: Candidate[]; total: number; page: number }>(
        [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
        (oldData) => {
          if (!oldData) return previousData;
          return {
            ...oldData,
            candidates: oldData.candidates.map(candidate =>
              candidate.id === id ? { ...candidate, ...data } : candidate
            )
          };
        }
      );

      return { previousData };
    },
    onError: (_, __, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
          context.previousData
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_CANDIDATES]);
    }
  });

  // Delete candidate mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCandidate,
    onMutate: async (id) => {
      await queryClient.cancelQueries([CACHE_KEYS.CANDIDATE_LIST]);
      
      const previousData = queryClient.getQueryData<{ candidates: Candidate[]; total: number; page: number }>(
        [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams]
      );

      queryClient.setQueryData<{ candidates: Candidate[]; total: number; page: number }>(
        [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
        (oldData) => {
          if (!oldData) return previousData;
          return {
            ...oldData,
            candidates: oldData.candidates.filter(candidate => candidate.id !== id),
            total: oldData.total - 1
          };
        }
      );

      return { previousData };
    },
    onError: (_, __, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          [CACHE_KEYS.CANDIDATE_LIST, debouncedSearchParams],
          context.previousData
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries([CACHE_KEYS.INVALIDATION_PATTERNS.ALL_CANDIDATES]);
    }
  });

  // AI matching mutation
  const matchMutation = useMutation({
    mutationFn: ({ jobId, filters }: { jobId: string; filters?: CandidateSearchParams }) =>
      matchCandidatesToJob(jobId, filters),
    onSuccess: (matchedCandidates) => {
      queryClient.setQueryData<CandidateWithMatchScore[]>(
        ['candidateMatches', matchedCandidates[0]?.id],
        matchedCandidates
      );
    }
  });

  // Search params update handler
  const updateSearchParams = useCallback((updates: Partial<CandidateSearchParams>) => {
    setSearchParams(prev => ({
      ...prev,
      ...updates,
      page: updates.query !== undefined ? 1 : prev.page // Reset page on new search
    }));
  }, []);

  // Pagination handlers
  const nextPage = useCallback(() => {
    if (candidatesData && candidatesData.page * searchParams.limit < candidatesData.total) {
      setSearchParams(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [candidatesData, searchParams.limit]);

  const previousPage = useCallback(() => {
    setSearchParams(prev => ({
      ...prev,
      page: prev.page > 1 ? prev.page - 1 : 1
    }));
  }, []);

  // Error handling
  const formatError = (error: unknown): DetailedError => {
    if (error instanceof Error) {
      return {
        message: error.message,
        code: 'ERROR',
        details: error['details' as keyof Error] as Record<string, string[]>
      };
    }
    return {
      message: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR'
    };
  };

  return {
    // Data and loading states
    candidates: candidatesData?.candidates || [],
    total: candidatesData?.total || 0,
    currentPage: candidatesData?.page || 1,
    isLoading,
    error: error ? formatError(error) : null,

    // Search functionality
    searchParams,
    updateSearchParams,

    // Pagination
    nextPage,
    previousPage,
    hasNextPage: candidatesData ? 
      candidatesData.page * searchParams.limit < candidatesData.total : false,
    hasPreviousPage: searchParams.page > 1,

    // CRUD operations
    createCandidate: createMutation.mutateAsync,
    updateCandidate: updateMutation.mutateAsync,
    deleteCandidate: deleteMutation.mutateAsync,
    matchCandidatesToJob: matchMutation.mutateAsync,

    // Operation states
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
    isMatching: matchMutation.isLoading,

    // Operation errors
    createError: createMutation.error ? formatError(createMutation.error) : null,
    updateError: updateMutation.error ? formatError(updateMutation.error) : null,
    deleteError: deleteMutation.error ? formatError(deleteMutation.error) : null,
    matchError: matchMutation.error ? formatError(matchMutation.error) : null,

    // Utilities
    refetch,
    reset: () => {
      setSearchParams({
        query: '',
        status: [],
        skills: [],
        location: '',
        remote_only: false,
        salary_min: 0,
        salary_max: 0,
        industries: [],
        experience_level: '',
        languages: [],
        is_actively_looking: false,
        availability_date: '',
        certifications: [],
        page: 1,
        limit: PAGINATION_DEFAULTS.PAGE_SIZE
      });
    }
  };
}