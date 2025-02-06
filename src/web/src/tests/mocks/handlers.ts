import { rest, HttpResponse } from 'msw'; // v1.3.0
import {
  mockJobs,
  mockCandidates,
  mockInterviews,
  generateMockJob,
  generateMockCandidate,
  generateMockInterview
} from './data';

// Simulate network latency
const SIMULATED_DELAY = () => Math.random() * 400 + 100; // 100-500ms delay

// Rate limiting configuration
const RATE_LIMITS = {
  jobs: 1000,
  candidates: 1000,
  interviews: 500
};

// Job-related handlers
const jobHandlers = [
  // GET /api/jobs - List jobs with pagination, search and filters
  rest.get('/api/jobs', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const query = url.searchParams.get('query') || '';
    const status = url.searchParams.getAll('status');

    let filteredJobs = [...mockJobs];
    
    // Apply filters
    if (query) {
      filteredJobs = filteredJobs.filter(job => 
        job.title.toLowerCase().includes(query.toLowerCase()) ||
        job.description.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (status.length) {
      filteredJobs = filteredJobs.filter(job => status.includes(job.status));
    }

    // Calculate pagination
    const total = filteredJobs.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedJobs,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      has_next: endIndex < total,
      has_previous: page > 1
    });
  }),

  // GET /api/jobs/:id - Get job details
  rest.get('/api/jobs/:id', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));
    
    const { id } = req.params;
    const job = mockJobs.find(j => j.id === id);

    if (!job) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Not Found'
      });
    }

    return HttpResponse.json({ data: job });
  }),

  // POST /api/jobs - Create new job
  rest.post('/api/jobs', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const body = await req.json();
    const newJob = generateMockJob({
      ...body,
      id: crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date()
    });

    mockJobs.push(newJob);
    return HttpResponse.json({ data: newJob }, { status: 201 });
  }),

  // PUT /api/jobs/:id - Update job
  rest.put('/api/jobs/:id', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const { id } = req.params;
    const body = await req.json();
    const jobIndex = mockJobs.findIndex(j => j.id === id);

    if (jobIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Not Found'
      });
    }

    const updatedJob = {
      ...mockJobs[jobIndex],
      ...body,
      updated_at: new Date()
    };
    mockJobs[jobIndex] = updatedJob;

    return HttpResponse.json({ data: updatedJob });
  })
];

// Candidate-related handlers
const candidateHandlers = [
  // GET /api/candidates - List candidates with pagination and filters
  rest.get('/api/candidates', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const query = url.searchParams.get('query') || '';
    const skills = url.searchParams.getAll('skills');

    let filteredCandidates = [...mockCandidates];

    // Apply filters
    if (query) {
      filteredCandidates = filteredCandidates.filter(candidate =>
        candidate.full_name.toLowerCase().includes(query.toLowerCase()) ||
        candidate.summary.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (skills.length) {
      filteredCandidates = filteredCandidates.filter(candidate =>
        skills.every(skill => candidate.skills.includes(skill))
      );
    }

    // Calculate pagination
    const total = filteredCandidates.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedCandidates,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      has_next: endIndex < total,
      has_previous: page > 1
    });
  }),

  // GET /api/candidates/:id - Get candidate details
  rest.get('/api/candidates/:id', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const { id } = req.params;
    const candidate = mockCandidates.find(c => c.id === id);

    if (!candidate) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Not Found'
      });
    }

    return HttpResponse.json({ data: candidate });
  }),

  // POST /api/candidates - Create new candidate
  rest.post('/api/candidates', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const body = await req.json();
    const newCandidate = generateMockCandidate({
      ...body,
      id: crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date()
    });

    mockCandidates.push(newCandidate);
    return HttpResponse.json({ data: newCandidate }, { status: 201 });
  })
];

// Interview-related handlers
const interviewHandlers = [
  // GET /api/interviews - List interviews with pagination
  rest.get('/api/interviews', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const candidateId = url.searchParams.get('candidate_id');
    const jobId = url.searchParams.get('job_id');

    let filteredInterviews = [...mockInterviews];

    // Apply filters
    if (candidateId) {
      filteredInterviews = filteredInterviews.filter(i => i.candidate_id === candidateId);
    }

    if (jobId) {
      filteredInterviews = filteredInterviews.filter(i => i.job_id === jobId);
    }

    // Calculate pagination
    const total = filteredInterviews.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedInterviews = filteredInterviews.slice(startIndex, endIndex);

    return HttpResponse.json({
      data: paginatedInterviews,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
      has_next: endIndex < total,
      has_previous: page > 1
    });
  }),

  // POST /api/interviews - Schedule new interview
  rest.post('/api/interviews', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const body = await req.json();
    const newInterview = generateMockInterview({
      ...body,
      id: crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date(),
      status: 'SCHEDULED'
    });

    mockInterviews.push(newInterview);
    return HttpResponse.json({ data: newInterview }, { status: 201 });
  }),

  // POST /api/interviews/:id/feedback - Submit interview feedback
  rest.post('/api/interviews/:id/feedback', async (req) => {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY()));

    const { id } = req.params;
    const body = await req.json();
    const interviewIndex = mockInterviews.findIndex(i => i.id === id);

    if (interviewIndex === -1) {
      return new HttpResponse(null, {
        status: 404,
        statusText: 'Not Found'
      });
    }

    const feedback = {
      id: crypto.randomUUID(),
      created_at: new Date(),
      updated_at: new Date(),
      interview_id: id,
      ...body
    };

    mockInterviews[interviewIndex].feedback.push(feedback);
    return HttpResponse.json({ data: feedback });
  })
];

// Combine all handlers
export const handlers = [
  ...jobHandlers,
  ...candidateHandlers,
  ...interviewHandlers
];