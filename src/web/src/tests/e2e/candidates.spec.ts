import { CandidateFormData, CandidateWithMatchScore, CandidateStatus } from '../../types/candidates';

// Test data constants
const TEST_CANDIDATE: CandidateFormData = {
  full_name: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  location: 'San Francisco, CA',
  status: CandidateStatus.ACTIVE,
  experience_level: 'Senior',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: [{
    company: 'Tech Corp',
    title: 'Senior Developer',
    start_date: new Date('2020-01-01'),
    end_date: null,
    description: 'Full-stack development',
    skills_used: ['React', 'TypeScript', 'Node.js'],
    location: 'San Francisco',
    is_current: true,
    industry: 'Technology',
    company_size: '100-500',
    achievements: ['Led team of 5 developers', 'Improved performance by 50%'],
    employment_type: 'Full-time'
  }],
  education: [{
    institution: 'Tech University',
    degree: 'BS',
    field_of_study: 'Computer Science',
    start_date: new Date('2015-09-01'),
    end_date: new Date('2019-05-31'),
    gpa: 3.8,
    achievements: ['Dean\'s List'],
    courses: ['Data Structures', 'Algorithms'],
    thesis_title: '',
    is_verified: true
  }],
  resume_url: 'https://storage.hotgigs.com/resumes/test-resume.pdf',
  preferences: {
    preferred_job_types: ['Full-time'],
    preferred_locations: ['San Francisco', 'Remote'],
    remote_only: false,
    salary_expectation_min: 120000,
    salary_expectation_max: 180000,
    open_to_relocation: true,
    preferred_industries: ['Technology', 'Finance'],
    industry_experience: ['Technology'],
    notice_period_days: 30,
    travel_willingness: 'Up to 25%',
    work_authorization: 'US Citizen',
    preferred_company_sizes: ['Startup', 'Mid-size'],
    preferred_work_schedule: 'Flexible',
    willing_to_travel: true
  },
  certifications: ['AWS Certified Developer'],
  languages: ['English'],
  social_profiles: {
    linkedin: 'https://linkedin.com/in/johndoe',
    github: 'https://github.com/johndoe'
  },
  summary: 'Experienced full-stack developer',
  last_active: new Date(),
  profile_complete: true
};

describe('Candidate Management E2E Tests', () => {
  beforeEach(() => {
    // Reset database state
    cy.task('db:clean');
    cy.task('db:seed');

    // Login as recruiter
    cy.login('recruiter@hotgigs.com', 'testpass123');

    // Visit candidates page
    cy.visit('/candidates');

    // Wait for initial load
    cy.get('[data-testid="candidates-list"]').should('exist');
  });

  describe('Candidate List View', () => {
    it('should display loading skeleton on initial load', () => {
      cy.get('[data-testid="candidate-skeleton"]').should('be.visible');
      cy.get('[data-testid="candidate-card"]').should('not.exist');
    });

    it('should display empty state when no candidates exist', () => {
      cy.task('db:clean');
      cy.reload();
      cy.get('[data-testid="empty-state"]').should('be.visible');
      cy.contains('No candidates found');
    });

    it('should display paginated list of candidates', () => {
      cy.get('[data-testid="candidate-card"]').should('have.length', 20);
      cy.get('[data-testid="pagination"]').should('exist');
    });

    it('should sort candidates by different criteria', () => {
      // Sort by name
      cy.get('[data-testid="sort-select"]').click();
      cy.get('[data-value="name"]').click();
      cy.get('[data-testid="candidate-name"]').then($names => {
        const names = [...$names].map(el => el.innerText);
        expect(names).to.equal(names.sort());
      });

      // Sort by match score
      cy.get('[data-testid="sort-select"]').click();
      cy.get('[data-value="match_score"]').click();
      cy.get('[data-testid="match-score"]').then($scores => {
        const scores = [...$scores].map(el => parseFloat(el.innerText));
        expect(scores).to.equal(scores.sort((a, b) => b - a));
      });
    });
  });

  describe('Candidate Search and Filters', () => {
    it('should search candidates by name', () => {
      cy.get('[data-testid="search-input"]').type('John');
      cy.get('[data-testid="candidate-card"]').should('have.length.gt', 0);
      cy.get('[data-testid="candidate-name"]').each($name => {
        expect($name.text().toLowerCase()).to.include('john');
      });
    });

    it('should filter candidates by skills', () => {
      cy.get('[data-testid="skill-filter"]').click();
      cy.get('[data-testid="skill-option-react"]').click();
      cy.get('[data-testid="skill-option-typescript"]').click();
      cy.get('[data-testid="apply-filters"]').click();

      cy.get('[data-testid="candidate-skills"]').each($skills => {
        const skills = $skills.text().toLowerCase();
        expect(skills).to.match(/react|typescript/);
      });
    });

    it('should filter by experience level', () => {
      cy.get('[data-testid="experience-filter"]').click();
      cy.get('[data-value="senior"]').click();
      cy.get('[data-testid="candidate-experience"]').each($exp => {
        expect($exp.text()).to.include('Senior');
      });
    });

    it('should persist filters across page reloads', () => {
      // Set filters
      cy.get('[data-testid="skill-filter"]').click();
      cy.get('[data-testid="skill-option-react"]').click();
      cy.get('[data-testid="apply-filters"]').click();

      // Reload page
      cy.reload();

      // Verify filters persisted
      cy.get('[data-testid="active-filters"]').should('contain', 'React');
    });
  });

  describe('AI Matching', () => {
    it('should display accurate match scores', () => {
      cy.intercept('GET', '/api/candidates/*/match-score').as('getMatchScore');
      
      cy.get('[data-testid="candidate-card"]').first().within(() => {
        cy.get('[data-testid="match-score"]').should('exist');
        cy.get('[data-testid="skill-match"]').should('exist');
        cy.get('[data-testid="experience-match"]').should('exist');
      });

      cy.wait('@getMatchScore').then((interception) => {
        const response = interception.response.body as CandidateWithMatchScore;
        expect(response.match_score).to.be.within(0, 1);
        expect(response.skill_match_percentage).to.be.within(0, 100);
      });
    });

    it('should update match scores when job requirements change', () => {
      cy.get('[data-testid="job-requirements"]').click();
      cy.get('[data-testid="add-skill"]').click();
      cy.get('[data-testid="skill-input"]').type('Python{enter}');
      cy.get('[data-testid="save-requirements"]').click();

      cy.get('[data-testid="match-score"]').should('exist');
      cy.get('[data-testid="recalculate-matches"]').click();

      cy.wait('@getMatchScore').then((interception) => {
        const response = interception.response.body as CandidateWithMatchScore;
        expect(response.match_score).to.be.within(0, 1);
      });
    });
  });

  describe('Candidate CRUD Operations', () => {
    it('should create a new candidate', () => {
      cy.get('[data-testid="add-candidate"]').click();
      
      // Fill form
      cy.get('[data-testid="name-input"]').type(TEST_CANDIDATE.full_name);
      cy.get('[data-testid="email-input"]').type(TEST_CANDIDATE.email);
      cy.get('[data-testid="skills-input"]').type('React{enter}TypeScript{enter}Node.js{enter}');
      
      // Upload resume
      cy.get('[data-testid="resume-upload"]').attachFile('test-resume.pdf');
      
      cy.get('[data-testid="save-candidate"]').click();
      
      // Verify success
      cy.get('[data-testid="success-toast"]').should('be.visible');
      cy.get('[data-testid="candidate-card"]').should('contain', TEST_CANDIDATE.full_name);
    });

    it('should edit existing candidate', () => {
      cy.get('[data-testid="candidate-card"]').first().click();
      cy.get('[data-testid="edit-candidate"]').click();
      
      const newName = 'Jane Smith';
      cy.get('[data-testid="name-input"]').clear().type(newName);
      cy.get('[data-testid="save-candidate"]').click();
      
      cy.get('[data-testid="success-toast"]').should('be.visible');
      cy.get('[data-testid="candidate-name"]').should('contain', newName);
    });

    it('should delete candidate', () => {
      cy.get('[data-testid="candidate-card"]').first().within(() => {
        cy.get('[data-testid="delete-candidate"]').click();
      });
      
      cy.get('[data-testid="confirm-delete"]').click();
      cy.get('[data-testid="success-toast"]').should('be.visible');
      cy.get('[data-testid="candidate-card"]').should('have.length.lessThan', 20);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      cy.intercept('GET', '/api/candidates*', { forceNetworkError: true });
      cy.reload();
      cy.get('[data-testid="error-state"]').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('exist');
    });

    it('should validate form inputs', () => {
      cy.get('[data-testid="add-candidate"]').click();
      cy.get('[data-testid="save-candidate"]').click();
      
      cy.get('[data-testid="name-error"]').should('be.visible');
      cy.get('[data-testid="email-error"]').should('be.visible');
    });

    it('should handle API errors with appropriate messages', () => {
      cy.intercept('POST', '/api/candidates', {
        statusCode: 400,
        body: {
          error: 'Validation failed',
          validation_errors: {
            email: ['Invalid email format']
          }
        }
      });

      cy.get('[data-testid="add-candidate"]').click();
      cy.get('[data-testid="email-input"]').type('invalid-email');
      cy.get('[data-testid="save-candidate"]').click();
      
      cy.get('[data-testid="error-toast"]').should('be.visible');
      cy.get('[data-testid="email-error"]').should('contain', 'Invalid email format');
    });
  });
});