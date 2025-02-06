import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { UserRole } from '../../types/auth';
import { JobStatus } from '../../types/jobs';
import { CandidateStatus } from '../../types/candidates';

// Global test constants
export const TEST_PASSWORD_HASH = '$2b$10$mockPasswordHashForTests';
export const TEST_JWT_SECRET = 'mock_jwt_secret_for_tests';

// Mock user generation function
export const generateMockUser = (
  role: UserRole,
  overrides: Partial<User> = {},
  authState: AuthState = { emailVerified: true, accountLocked: false }
): User => {
  const baseUser: User = {
    id: uuidv4(),
    email: `test.${role.toLowerCase()}@hotgigs.io`,
    full_name: `Test ${role.charAt(0) + role.slice(1).toLowerCase()}`,
    role,
    profile: {
      avatar_url: `https://avatars.hotgigs.io/${role.toLowerCase()}.jpg`,
      phone: '+1234567890',
      skills: ['JavaScript', 'TypeScript', 'React'],
      location: 'New York, NY',
      timezone: 'America/New_York',
      linkedin_url: `https://linkedin.com/in/test-${role.toLowerCase()}`,
      certifications: ['AWS Certified Developer'],
      languages: ['English', 'Spanish'],
      preferences: {
        theme: 'light',
        notifications: true
      },
      notification_settings: {
        email: true,
        push: true,
        sms: false
      }
    },
    email_verified: authState.emailVerified,
    last_login: new Date(),
    failed_login_attempts: 0,
    account_locked: authState.accountLocked,
    allowed_ip_addresses: ['127.0.0.1'],
    security_questions: ['What is your favorite color?'],
    created_at: new Date(),
    updated_at: new Date()
  };

  return { ...baseUser, ...overrides };
};

// Mock job generation function
export const generateMockJob = (
  status: JobStatus,
  overrides: Partial<Job> = {},
  matchingCriteria: MatchingCriteria = { skillWeight: 0.6, experienceWeight: 0.4 }
): Job => {
  const baseJob: Job = {
    id: uuidv4(),
    title: 'Senior Software Engineer',
    description: 'We are looking for an experienced software engineer...',
    creator_id: uuidv4(),
    requirements: {
      experience_level: ExperienceLevel.SENIOR,
      years_experience: 5,
      required_skills: ['TypeScript', 'React', 'Node.js'],
      preferred_skills: ['AWS', 'Docker', 'Kubernetes'],
      qualifications: ['Bachelor\'s in Computer Science or related field'],
      responsibilities: ['Lead development of core features']
    },
    status,
    type: JobType.FULL_TIME,
    skills: ['TypeScript', 'React', 'Node.js', 'AWS'],
    posted_at: new Date(),
    closed_at: status === JobStatus.ARCHIVED ? new Date() : null,
    salary_min: 120000,
    salary_max: 180000,
    location: 'New York, NY',
    remote_allowed: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  return { ...baseJob, ...overrides };
};

// Mock candidate generation function
export const generateMockCandidate = (
  status: CandidateStatus,
  overrides: Partial<Candidate> = {},
  skills: string[] = ['TypeScript', 'React', 'Node.js']
): Candidate => {
  const baseCandidate: Candidate = {
    id: uuidv4(),
    full_name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    location: 'New York, NY',
    status,
    experience_level: ExperienceLevel.SENIOR,
    skills,
    experience: [
      {
        company: 'Tech Corp',
        title: 'Senior Developer',
        start_date: new Date('2020-01-01'),
        end_date: null,
        description: 'Led development of core features...',
        skills_used: ['TypeScript', 'React', 'Node.js'],
        location: 'New York, NY',
        is_current: true,
        achievements: ['Increased performance by 50%'],
        industry: 'Technology'
      }
    ],
    education: [
      {
        institution: 'Tech University',
        degree: 'Bachelor of Science',
        field_of_study: 'Computer Science',
        start_date: new Date('2012-09-01'),
        end_date: new Date('2016-05-01'),
        gpa: 3.8,
        achievements: ['Dean\'s List'],
        is_verified: true,
        certifications: ['AWS Certified Developer']
      }
    ],
    resume_url: 'https://storage.hotgigs.io/resumes/mock-resume.pdf',
    preferences: {
      preferred_job_types: [JobType.FULL_TIME],
      preferred_locations: ['New York, NY', 'Remote'],
      remote_only: false,
      salary_expectation_min: 120000,
      salary_expectation_max: 180000,
      open_to_relocation: true,
      preferred_industries: ['Technology', 'Finance'],
      preferred_companies: ['Google', 'Amazon'],
      preferred_travel_percentage: 20,
      excluded_industries: ['Oil & Gas']
    },
    match_score: 85,
    metadata: {
      last_activity: new Date(),
      source: 'Direct Application'
    },
    created_at: new Date(),
    updated_at: new Date()
  };

  return { ...baseCandidate, ...overrides };
};

// Pre-generated mock data exports
export const mockUsers = {
  adminUser: generateMockUser(UserRole.ADMIN),
  recruiterUser: generateMockUser(UserRole.RECRUITER),
  hiringManagerUser: generateMockUser(UserRole.HIRING_MANAGER)
};

export const mockJobs = {
  publishedJob: generateMockJob(JobStatus.PUBLISHED),
  draftJob: generateMockJob(JobStatus.DRAFT),
  archivedJob: generateMockJob(JobStatus.ARCHIVED)
};

export const mockCandidates = {
  activeCandidate: generateMockCandidate(CandidateStatus.ACTIVE),
  inactiveCandidate: generateMockCandidate(CandidateStatus.PASSIVE),
  blacklistedCandidate: generateMockCandidate(CandidateStatus.ARCHIVED)
};

// Type definitions for internal use
interface AuthState {
  emailVerified: boolean;
  accountLocked: boolean;
}

interface MatchingCriteria {
  skillWeight: number;
  experienceWeight: number;
}