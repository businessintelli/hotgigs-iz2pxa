import { JobFormData, JobSearchParams, JobStatus, JobType, ExperienceLevel } from '../../types/jobs';
import type { PaginatedResponse } from '../../types/common';

// Cypress v13.0.0
describe('Job Management E2E Tests', () => {
  const TEST_JOB_DATA: JobFormData = {
    title: 'Senior React Developer',
    description: 'We are looking for an experienced React developer...',
    requirements: {
      experience_level: ExperienceLevel.SENIOR,
      years_experience: 5,
      required_skills: ['React', 'TypeScript', 'Node.js'],
      preferred_skills: ['GraphQL', 'AWS'],
      qualifications: ['Bachelor\'s in Computer Science or related field'],
      responsibilities: ['Lead frontend development', 'Mentor junior developers'],
      certifications: [],
      education_requirements: ['Bachelor\'s Degree'],
      languages: ['English'],
      skill_proficiency: { React: 90, TypeScript: 85, 'Node.js': 80 },
      background_check_required: true,
      tools_and_technologies: ['Git', 'JIRA', 'Webpack']
    },
    type: JobType.FULL_TIME,
    skills: ['React', 'TypeScript', 'Node.js'],
    salary_min: 100000,
    salary_max: 150000,
    location: 'San Francisco, CA',
    remote_allowed: true,
    department: 'Engineering',
    benefits: ['Health Insurance', '401k', 'Stock Options'],
    is_draft: false,
    publish_date: new Date(),
    form_state: {
      is_dirty: false,
      touched_fields: [],
      last_saved: null
    },
    validation: {
      required_fields: ['title', 'description', 'requirements'],
      custom_validators: {},
      async_validators: {}
    },
    attachments: []
  };

  beforeEach(() => {
    cy.task('db:reset');
    cy.intercept('GET', '/api/jobs*').as('getJobs');
    cy.intercept('POST', '/api/jobs').as('createJob');
    cy.intercept('PUT', '/api/jobs/*').as('updateJob');
    cy.intercept('DELETE', '/api/jobs/*').as('deleteJob');
    
    // Login as recruiter
    cy.login('recruiter@hotgigs.io', 'password123');
    
    // Clear local storage and cookies
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Job Listing Page', () => {
    it('displays job listings with correct pagination', () => {
      cy.visit('/jobs');
      cy.wait('@getJobs');

      // Verify job cards are displayed
      cy.get('[data-testid="job-card"]')
        .should('have.length.at.least', 1)
        .first()
        .within(() => {
          cy.get('[data-testid="job-title"]').should('be.visible');
          cy.get('[data-testid="job-department"]').should('be.visible');
          cy.get('[data-testid="job-location"]').should('be.visible');
          cy.get('[data-testid="job-salary-range"]').should('be.visible');
        });

      // Test pagination
      cy.get('[data-testid="pagination"]').within(() => {
        cy.get('[data-testid="next-page"]').click();
        cy.wait('@getJobs');
        cy.url().should('include', 'page=2');
      });
    });

    it('filters jobs by search query and criteria', () => {
      cy.visit('/jobs');
      
      // Test search functionality
      cy.get('[data-testid="job-search"]').type('React{enter}');
      cy.wait('@getJobs');
      cy.get('[data-testid="job-card"]').should('contain', 'React');

      // Test filters
      cy.get('[data-testid="filter-dropdown"]').click();
      cy.get('[data-testid="experience-filter"]').select(ExperienceLevel.SENIOR);
      cy.get('[data-testid="type-filter"]').select(JobType.FULL_TIME);
      cy.get('[data-testid="location-filter"]').type('San Francisco{enter}');
      
      cy.wait('@getJobs');
      cy.get('[data-testid="job-card"]').should('have.length.at.least', 1);
    });

    it('handles empty search results gracefully', () => {
      cy.visit('/jobs');
      cy.get('[data-testid="job-search"]').type('NonexistentJobXYZ{enter}');
      cy.wait('@getJobs');
      
      cy.get('[data-testid="no-results"]')
        .should('be.visible')
        .and('contain', 'No jobs found');
    });
  });

  describe('Job Creation', () => {
    it('creates a new job posting successfully', () => {
      cy.visit('/jobs/new');
      
      // Fill form fields
      cy.get('[data-testid="job-title"]').type(TEST_JOB_DATA.title);
      cy.get('[data-testid="job-description"]')
        .find('.editor-content')
        .type(TEST_JOB_DATA.description);
      
      // Select job type
      cy.get('[data-testid="job-type"]').select(TEST_JOB_DATA.type);
      
      // Add required skills
      TEST_JOB_DATA.requirements.required_skills.forEach(skill => {
        cy.get('[data-testid="skills-input"]').type(`${skill}{enter}`);
      });

      // Set salary range
      cy.get('[data-testid="salary-min"]').type(TEST_JOB_DATA.salary_min.toString());
      cy.get('[data-testid="salary-max"]').type(TEST_JOB_DATA.salary_max.toString());
      
      // Submit form
      cy.get('[data-testid="submit-job"]').click();
      cy.wait('@createJob').its('response.statusCode').should('eq', 201);
      
      // Verify success message
      cy.get('[data-testid="success-toast"]')
        .should('be.visible')
        .and('contain', 'Job posted successfully');
    });

    it('validates required fields', () => {
      cy.visit('/jobs/new');
      cy.get('[data-testid="submit-job"]').click();
      
      // Check validation messages
      cy.get('[data-testid="title-error"]')
        .should('be.visible')
        .and('contain', 'Title is required');
      
      cy.get('[data-testid="description-error"]')
        .should('be.visible')
        .and('contain', 'Description is required');
    });
  });

  describe('Job Editing', () => {
    beforeEach(() => {
      // Create a job first
      cy.request('POST', '/api/jobs', TEST_JOB_DATA)
        .then(response => {
          cy.wrap(response.body.data.id).as('jobId');
        });
    });

    it('updates job details successfully', function() {
      cy.visit(`/jobs/${this.jobId}/edit`);
      
      // Update title
      cy.get('[data-testid="job-title"]')
        .clear()
        .type('Updated React Developer Position');
      
      // Update salary
      cy.get('[data-testid="salary-max"]')
        .clear()
        .type('160000');
      
      // Save changes
      cy.get('[data-testid="save-changes"]').click();
      cy.wait('@updateJob').its('response.statusCode').should('eq', 200);
      
      // Verify changes
      cy.get('[data-testid="success-toast"]')
        .should('be.visible')
        .and('contain', 'Job updated successfully');
    });
  });

  describe('Job Deletion', () => {
    beforeEach(() => {
      cy.request('POST', '/api/jobs', TEST_JOB_DATA)
        .then(response => {
          cy.wrap(response.body.data.id).as('jobId');
        });
    });

    it('deletes a job posting with confirmation', function() {
      cy.visit(`/jobs/${this.jobId}`);
      
      // Click delete button
      cy.get('[data-testid="delete-job"]').click();
      
      // Confirm deletion
      cy.get('[data-testid="confirm-delete"]').click();
      cy.wait('@deleteJob').its('response.statusCode').should('eq', 200);
      
      // Verify deletion
      cy.get('[data-testid="success-toast"]')
        .should('be.visible')
        .and('contain', 'Job deleted successfully');
      
      // Verify redirect
      cy.url().should('eq', Cypress.config().baseUrl + '/jobs');
    });
  });

  describe('Performance Tests', () => {
    it('loads job listing within performance threshold', () => {
      cy.visit('/jobs', {
        onBeforeLoad: (win) => {
          win.performance.mark('start-load');
        },
      });

      cy.wait('@getJobs');
      
      cy.window().then((win) => {
        win.performance.mark('end-load');
        win.performance.measure('load-time', 'start-load', 'end-load');
        
        const measure = win.performance.getEntriesByName('load-time')[0];
        expect(measure.duration).to.be.lessThan(2000); // 2 second threshold
      });
    });
  });
});