import { z } from 'zod'; // ^3.22.0
import { Job, JobStatus, JobType, ExperienceLevel, jobRequirementsSchema } from '../../types/jobs';
import { BaseEntity, UUID } from '../../types/common';

// Constants for schema validation and table configuration
const TABLE_NAME = 'jobs';
const SCHEMA_VERSION = '1.1';

const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 5000;
const MIN_SALARY = 0;
const MAX_SALARY = 1000000;

/**
 * Enhanced Zod schema for job validation with strict rules and custom error messages
 */
export class JobSchema {
  private schema: z.ZodObject<any>;

  constructor() {
    this.schema = z.object({
      // Base entity fields from common types
      id: z.string().uuid({
        message: "Invalid job ID format - must be a valid UUID"
      }),
      created_at: z.date(),
      updated_at: z.date(),

      // Job-specific fields with enhanced validation
      title: z.string()
        .min(MIN_TITLE_LENGTH, `Job title must be at least ${MIN_TITLE_LENGTH} characters`)
        .max(MAX_TITLE_LENGTH, `Job title cannot exceed ${MAX_TITLE_LENGTH} characters`)
        .regex(/^[a-zA-Z0-9\s\-\(\)]+$/, "Job title can only contain letters, numbers, spaces, hyphens and parentheses"),

      description: z.string()
        .min(MIN_DESCRIPTION_LENGTH, `Job description must be at least ${MIN_DESCRIPTION_LENGTH} characters`)
        .max(MAX_DESCRIPTION_LENGTH, `Job description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`),

      creator_id: z.string().uuid({
        message: "Invalid creator ID format - must be a valid UUID"
      }),

      requirements: jobRequirementsSchema,
      
      status: z.nativeEnum(JobStatus, {
        errorMap: () => ({ message: "Invalid job status value" })
      }),

      type: z.nativeEnum(JobType, {
        errorMap: () => ({ message: "Invalid job type value" })
      }),

      skills: z.array(z.string())
        .min(1, "At least one skill must be specified")
        .max(20, "Cannot exceed 20 skills per job posting"),

      posted_at: z.date(),
      
      closed_at: z.date().nullable(),

      salary_min: z.number()
        .min(MIN_SALARY, "Minimum salary cannot be negative")
        .max(MAX_SALARY, "Salary exceeds maximum allowed value"),

      salary_max: z.number()
        .min(MIN_SALARY, "Maximum salary cannot be negative")
        .max(MAX_SALARY, "Salary exceeds maximum allowed value"),

      location: z.string()
        .min(2, "Location must be at least 2 characters")
        .max(100, "Location cannot exceed 100 characters"),

      remote_allowed: z.boolean()
    }).refine(
      (data) => data.salary_max >= data.salary_min,
      {
        message: "Maximum salary must be greater than or equal to minimum salary",
        path: ["salary_max"]
      }
    );
  }

  /**
   * Validates job data against the schema with detailed error reporting
   */
  validate(data: unknown): Job {
    return this.schema.parse(data) as Job;
  }
}

// Export singleton instance of job schema
export const jobSchema = new JobSchema();

/**
 * Generates SQL for creating the jobs table with enhanced fields and optimized indexes
 */
export function createJobTable(): string {
  return `
    CREATE TABLE ${TABLE_NAME} (
      -- Base entity columns
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

      -- Job-specific columns
      title VARCHAR(${MAX_TITLE_LENGTH}) NOT NULL,
      description TEXT NOT NULL,
      creator_id UUID NOT NULL REFERENCES users(id),
      requirements JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT '${JobStatus.DRAFT}',
      type VARCHAR(20) NOT NULL,
      skills TEXT[] NOT NULL,
      posted_at TIMESTAMP WITH TIME ZONE,
      closed_at TIMESTAMP WITH TIME ZONE,
      salary_min INTEGER NOT NULL CHECK (salary_min >= ${MIN_SALARY}),
      salary_max INTEGER NOT NULL CHECK (salary_max >= salary_min),
      location VARCHAR(100) NOT NULL,
      remote_allowed BOOLEAN NOT NULL DEFAULT false,

      -- Constraints
      CONSTRAINT salary_range_check CHECK (
        salary_max <= ${MAX_SALARY} AND
        salary_min >= ${MIN_SALARY} AND
        salary_max >= salary_min
      ),
      CONSTRAINT title_length_check CHECK (
        length(title) >= ${MIN_TITLE_LENGTH} AND
        length(title) <= ${MAX_TITLE_LENGTH}
      ),
      CONSTRAINT description_length_check CHECK (
        length(description) >= ${MIN_DESCRIPTION_LENGTH} AND
        length(description) <= ${MAX_DESCRIPTION_LENGTH}
      )
    );

    -- Indexes for optimized queries
    CREATE INDEX idx_jobs_title ON ${TABLE_NAME} USING GiST (title gist_trgm_ops);
    CREATE INDEX idx_jobs_status ON ${TABLE_NAME} (status);
    CREATE INDEX idx_jobs_type ON ${TABLE_NAME} (type);
    CREATE INDEX idx_jobs_skills ON ${TABLE_NAME} USING GIN (skills);
    CREATE INDEX idx_jobs_salary ON ${TABLE_NAME} (salary_min, salary_max);
    CREATE INDEX idx_jobs_remote ON ${TABLE_NAME} (remote_allowed);
    CREATE INDEX idx_jobs_location ON ${TABLE_NAME} (location);
    CREATE INDEX idx_jobs_posted_at ON ${TABLE_NAME} (posted_at);

    -- Row-level security policies
    ALTER TABLE ${TABLE_NAME} ENABLE ROW LEVEL SECURITY;

    -- Policy for viewing published jobs
    CREATE POLICY view_published_jobs ON ${TABLE_NAME}
      FOR SELECT
      USING (status = '${JobStatus.PUBLISHED}');

    -- Policy for managing own jobs
    CREATE POLICY manage_own_jobs ON ${TABLE_NAME}
      FOR ALL
      USING (creator_id = current_user_id());

    -- Policy for admin access
    CREATE POLICY admin_access ON ${TABLE_NAME}
      FOR ALL
      USING (current_user_is_admin());

    -- Add table comments
    COMMENT ON TABLE ${TABLE_NAME} IS 'Job postings with enhanced fields and security - Schema v${SCHEMA_VERSION}';
    COMMENT ON COLUMN ${TABLE_NAME}.requirements IS 'Structured job requirements in JSONB format';
    COMMENT ON COLUMN ${TABLE_NAME}.salary_min IS 'Minimum salary in base currency';
    COMMENT ON COLUMN ${TABLE_NAME}.salary_max IS 'Maximum salary in base currency';
    COMMENT ON COLUMN ${TABLE_NAME}.remote_allowed IS 'Indicates if remote work is allowed for this position';

    -- Trigger for updating updated_at timestamp
    CREATE TRIGGER update_jobs_timestamp
      BEFORE UPDATE ON ${TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
  `;
}