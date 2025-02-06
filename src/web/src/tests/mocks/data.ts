import { BaseEntity } from '../../types/common';
import { Job, JobStatus, JobType, ExperienceLevel } from '../../types/jobs';
import { Candidate, CandidateStatus } from '../../types/candidates';
import { Interview, InterviewType, InterviewStatus, InterviewMode, FeedbackRating } from '../../types/interviews';

// Version tracking for mock data
export const MOCK_DATA_VERSION = '1.0.0';

// Helper function to generate base entity fields
const generateBaseFields = (): Omit<BaseEntity, 'id'> => ({
  created_at: new Date(),
  updated_at: new Date()
});

// Generate mock job with required fields and optional overrides
export function generateMockJob(overrides: Partial<Job> = {}): Job {
  const baseJob: Job = {
    id: crypto.randomUUID(),
    ...generateBaseFields(),
    title: 'Senior Software Engineer',
    description: 'We are seeking an experienced software engineer...',
    creator_id: crypto.randomUUID(),
    requirements: {
      experience_level: ExperienceLevel.SENIOR,
      years_experience: 5,
      required_skills: ['TypeScript', 'React', 'Node.js'],
      preferred_skills: ['GraphQL', 'AWS'],
      qualifications: ['Bachelor\'s in Computer Science or related field'],
      responsibilities: ['Lead development of core features'],
      certifications: [],
      education_requirements: ['Bachelor\'s Degree'],
      languages: ['English'],
      skill_proficiency: { 'TypeScript': 4, 'React': 4 },
      background_check_required: true,
      tools_and_technologies: ['Git', 'Docker']
    },
    status: JobStatus.PUBLISHED,
    type: JobType.FULL_TIME,
    skills: ['TypeScript', 'React', 'Node.js'],
    posted_at: new Date(),
    closed_at: null,
    salary_min: 120000,
    salary_max: 180000,
    location: 'San Francisco, CA',
    remote_allowed: true,
    department: 'Engineering',
    benefits: ['Health Insurance', '401k'],
    metadata: {},
    views_count: 0,
    applications_count: 0,
    tags: ['tech', 'engineering'],
    is_featured: false,
    expires_at: null
  };

  return { ...baseJob, ...overrides };
}

// Generate mock candidate with required fields and optional overrides
export function generateMockCandidate(overrides: Partial<Candidate> = {}): Candidate {
  const baseCandidate: Candidate = {
    id: crypto.randomUUID(),
    ...generateBaseFields(),
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-555-5555',
    location: 'San Francisco, CA',
    status: CandidateStatus.ACTIVE,
    experience_level: 'Senior',
    skills: ['TypeScript', 'React', 'Node.js'],
    experience: [{
      company: 'Tech Corp',
      title: 'Senior Developer',
      start_date: new Date('2020-01-01'),
      end_date: null,
      description: 'Led development of core features',
      skills_used: ['TypeScript', 'React'],
      location: 'San Francisco, CA',
      is_current: true,
      industry: 'Technology',
      company_size: '500-1000',
      achievements: ['Increased performance by 50%'],
      employment_type: 'Full-time'
    }],
    education: [{
      institution: 'University of Technology',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      start_date: new Date('2012-09-01'),
      end_date: new Date('2016-05-01'),
      gpa: 3.8,
      achievements: ['Dean\'s List'],
      courses: ['Data Structures', 'Algorithms'],
      thesis_title: '',
      is_verified: true
    }],
    resume_url: 'https://storage.example.com/resumes/john-doe.pdf',
    preferences: {
      preferred_job_types: ['FULL_TIME'],
      preferred_locations: ['San Francisco', 'Remote'],
      remote_only: false,
      salary_expectation_min: 130000,
      salary_expectation_max: 180000,
      open_to_relocation: true,
      preferred_industries: ['Technology'],
      industry_experience: ['Software'],
      notice_period_days: 30,
      travel_willingness: 'Up to 25%',
      work_authorization: 'US Citizen',
      preferred_company_sizes: ['Startup', 'Mid-size'],
      preferred_work_schedule: 'Regular',
      willing_to_travel: true
    },
    certifications: ['AWS Certified Developer'],
    languages: ['English'],
    social_profiles: {
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe'
    },
    summary: 'Experienced software engineer with focus on web technologies',
    last_active: new Date(),
    profile_complete: true
  };

  return { ...baseCandidate, ...overrides };
}

// Generate mock interview with required fields and optional overrides
export function generateMockInterview(overrides: Partial<Interview> = {}): Interview {
  const baseInterview: Interview = {
    id: crypto.randomUUID(),
    ...generateBaseFields(),
    candidate_id: crypto.randomUUID(),
    job_id: crypto.randomUUID(),
    type: InterviewType.TECHNICAL,
    status: InterviewStatus.SCHEDULED,
    mode: InterviewMode.VIDEO,
    scheduled_at: new Date(),
    duration_minutes: 60,
    interviewer_ids: [crypto.randomUUID()],
    meeting_link: 'https://meet.example.com/interview',
    calendar_event_id: crypto.randomUUID(),
    location: null,
    notes: 'Technical interview for senior position',
    feedback: [{
      id: crypto.randomUUID(),
      ...generateBaseFields(),
      interview_id: crypto.randomUUID(),
      interviewer_id: crypto.randomUUID(),
      overall_rating: FeedbackRating.YES,
      skill_ratings: [{
        skill_name: 'TypeScript',
        rating: 4,
        comments: 'Strong TypeScript knowledge'
      }],
      strengths: 'Strong technical background',
      weaknesses: 'Could improve system design skills',
      notes: 'Good candidate overall',
      hire_recommendation: true
    }]
  };

  return { ...baseInterview, ...overrides };
}

// Generate arrays of mock data
export const mockJobs: Job[] = Array.from({ length: 5 }, (_, i) => 
  generateMockJob({ title: `Mock Job ${i + 1}` })
);

export const mockCandidates: Candidate[] = Array.from({ length: 5 }, (_, i) => 
  generateMockCandidate({ full_name: `Mock Candidate ${i + 1}` })
);

export const mockInterviews: Interview[] = Array.from({ length: 5 }, (_, i) => 
  generateMockInterview()
);

// Validation function for mock data
export function validateMockData(data: unknown, entityType: string): boolean {
  try {
    switch (entityType) {
      case 'job':
        return Boolean(data && typeof data === 'object' && 'title' in data);
      case 'candidate':
        return Boolean(data && typeof data === 'object' && 'full_name' in data);
      case 'interview':
        return Boolean(data && typeof data === 'object' && 'type' in data);
      default:
        return false;
    }
  } catch {
    return false;
  }
}