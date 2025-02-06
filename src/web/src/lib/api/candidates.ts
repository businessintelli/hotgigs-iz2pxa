import { z } from 'zod'; // ^3.22.0
import { supabase } from '../supabase';
import { ApiError } from '@/lib/errors';
import { FILE_UPLOAD, PAGINATION_DEFAULTS } from '../../config/constants';
import {
  Candidate,
  CandidateFormData,
  CandidateSearchParams,
  CandidateWithMatchScore,
  candidateSchema,
  candidateSearchParamsSchema
} from '../../types/candidates';
import { createPaginatedResponse } from '../../types/common';

/**
 * Creates a new candidate profile with validation and secure file handling
 */
export async function createCandidate(
  data: CandidateFormData,
  resumeFile?: File
): Promise<Candidate> {
  try {
    // Validate candidate data
    const validatedData = candidateSchema.parse(data);

    let resumeUrl = '';
    if (resumeFile) {
      // Validate file
      if (resumeFile.size > FILE_UPLOAD.MAX_SIZE) {
        throw new ApiError('File size exceeds limit', 'VALIDATION_ERROR');
      }
      if (!FILE_UPLOAD.ALLOWED_TYPES.includes(resumeFile.type)) {
        throw new ApiError('Invalid file type', 'VALIDATION_ERROR');
      }

      // Generate unique file name
      const fileExt = resumeFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      // Upload file
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, resumeFile, {
          contentType: resumeFile.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw new ApiError('Resume upload failed', 'INTERNAL_ERROR');
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);
      
      resumeUrl = publicUrl;
    }

    // Create candidate record
    const { data: candidate, error } = await supabase
      .from('candidates')
      .insert({
        ...validatedData,
        resume_url: resumeUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) throw new ApiError('Failed to create candidate', 'INTERNAL_ERROR');

    return candidate;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError('Invalid candidate data', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
}

/**
 * Updates an existing candidate profile with validation and file handling
 */
export async function updateCandidate(
  id: string,
  data: Partial<CandidateFormData>,
  newResumeFile?: File
): Promise<Candidate> {
  try {
    // Validate update data
    const validatedData = candidateSchema.partial().parse(data);

    let resumeUrl = data.resume_url;
    if (newResumeFile) {
      // Validate and upload new resume file
      if (newResumeFile.size > FILE_UPLOAD.MAX_SIZE) {
        throw new ApiError('File size exceeds limit', 'VALIDATION_ERROR');
      }
      if (!FILE_UPLOAD.ALLOWED_TYPES.includes(newResumeFile.type)) {
        throw new ApiError('Invalid file type', 'VALIDATION_ERROR');
      }

      const fileExt = newResumeFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      // Delete old resume if exists
      if (data.resume_url) {
        const oldFileName = data.resume_url.split('/').pop();
        await supabase.storage.from('resumes').remove([oldFileName!]);
      }

      // Upload new resume
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, newResumeFile, {
          contentType: newResumeFile.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw new ApiError('Resume upload failed', 'INTERNAL_ERROR');

      const { data: { publicUrl } } = supabase.storage
        .from('resumes')
        .getPublicUrl(fileName);
      
      resumeUrl = publicUrl;
    }

    // Update candidate record
    const { data: candidate, error } = await supabase
      .from('candidates')
      .update({
        ...validatedData,
        resume_url: resumeUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new ApiError('Failed to update candidate', 'INTERNAL_ERROR');

    return candidate;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError('Invalid update data', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
}

/**
 * Advanced candidate search with filters, pagination and caching
 */
export async function searchCandidates(
  params: CandidateSearchParams
): Promise<{
  candidates: Candidate[];
  total: number;
  page: number;
}> {
  try {
    // Validate search parameters
    const validatedParams = candidateSearchParamsSchema.parse(params);

    // Build query
    let query = supabase
      .from('candidates')
      .select('*', { count: 'exact' });

    // Apply filters
    if (validatedParams.query) {
      query = query.textSearch('full_name', validatedParams.query);
    }
    if (validatedParams.status?.length) {
      query = query.in('status', validatedParams.status);
    }
    if (validatedParams.skills?.length) {
      query = query.contains('skills', validatedParams.skills);
    }
    if (validatedParams.location) {
      query = query.ilike('location', `%${validatedParams.location}%`);
    }

    // Apply pagination
    const page = validatedParams.page || PAGINATION_DEFAULTS.DEFAULT_PAGE_NUMBER;
    const limit = validatedParams.limit || PAGINATION_DEFAULTS.PAGE_SIZE;
    const offset = (page - 1) * limit;

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Execute query
    const { data: candidates, error, count } = await query;

    if (error) throw new ApiError('Search failed', 'INTERNAL_ERROR');

    return {
      candidates,
      total: count || 0,
      page
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError('Invalid search parameters', 'VALIDATION_ERROR', error.errors);
    }
    throw error;
  }
}

/**
 * AI-powered candidate matching for jobs using OpenAI embeddings
 */
export async function matchCandidatesToJob(
  jobId: string,
  filters?: CandidateSearchParams
): Promise<CandidateWithMatchScore[]> {
  try {
    // Call matching function with optional filters
    const { data: matches, error } = await supabase.rpc('match_candidates', {
      p_job_id: jobId,
      p_filters: filters || {}
    });

    if (error) throw new ApiError('Matching failed', 'INTERNAL_ERROR');

    // Get full candidate details with match scores
    const candidateIds = matches.map(m => m.candidate_id);
    const { data: candidates, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .in('id', candidateIds);

    if (fetchError) throw new ApiError('Failed to fetch candidates', 'INTERNAL_ERROR');

    // Combine candidate details with match scores
    return candidates.map(candidate => ({
      ...candidate,
      match_score: matches.find(m => m.candidate_id === candidate.id)?.score || 0,
      matched_jobs: 1,
      skill_match_percentage: 0, // Calculated by backend function
      experience_match_percentage: 0, // Calculated by backend function
      location_match_score: 0, // Calculated by backend function
      cultural_fit_score: 0, // Calculated by backend function
      last_match_calculation: new Date()
    }));
  } catch (error) {
    throw new ApiError('Matching process failed', 'INTERNAL_ERROR');
  }
}