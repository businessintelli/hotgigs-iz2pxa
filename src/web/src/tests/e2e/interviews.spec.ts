import { InterviewType, InterviewMode } from '../../types/interviews';

// Test data constants
const TEST_INTERVIEW = {
  candidateId: '550e8400-e29b-41d4-a716-446655440000',
  jobId: '7c4e3f20-d18b-4fb8-a877-f86be659e6d5',
  type: InterviewType.TECHNICAL,
  mode: InterviewMode.VIDEO,
  scheduledAt: new Date('2024-01-20T14:00:00Z'),
  durationMinutes: 60,
  interviewerIds: ['a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f'],
  notes: 'Technical interview for senior developer position'
};

// Selectors for UI elements
const SELECTORS = {
  scheduleBtn: '[data-cy=schedule-interview-btn]',
  interviewForm: '[data-cy=interview-form]',
  typeSelect: '[data-cy=interview-type-select]',
  modeSelect: '[data-cy=interview-mode-select]',
  dateInput: '[data-cy=interview-date-input]',
  timeInput: '[data-cy=interview-time-input]',
  durationInput: '[data-cy=duration-input]',
  interviewerSelect: '[data-cy=interviewer-select]',
  notesInput: '[data-cy=notes-input]',
  submitBtn: '[data-cy=submit-interview-btn]',
  cancelBtn: '[data-cy=cancel-interview-btn]',
  feedbackForm: '[data-cy=feedback-form]',
  calendarView: '[data-cy=calendar-view]',
  listView: '[data-cy=list-view]',
  errorMsg: '[data-cy=error-message]',
  successMsg: '[data-cy=success-message]'
};

describe('Interview Management', () => {
  beforeEach(() => {
    // Set up test environment
    cy.intercept('GET', '/api/interviews/*', { fixture: 'interviews.json' }).as('getInterviews');
    cy.intercept('POST', '/api/interviews', { statusCode: 201 }).as('createInterview');
    cy.intercept('PUT', '/api/interviews/*', { statusCode: 200 }).as('updateInterview');
    cy.intercept('DELETE', '/api/interviews/*', { statusCode: 200 }).as('deleteInterview');
    cy.intercept('POST', '/api/interviews/*/feedback', { statusCode: 201 }).as('submitFeedback');
    
    // Mock Google Calendar API
    cy.intercept('POST', '/api/calendar/events', { statusCode: 201 }).as('createCalendarEvent');
    
    // Set up WebSocket connection for real-time updates
    cy.intercept('GET', '/realtime*', { statusCode: 101 }).as('websocket');
    
    // Visit interviews page
    cy.visit('/interviews');
    cy.viewport(1280, 800);
  });

  describe('Interview Scheduling', () => {
    it('should schedule a new interview successfully', () => {
      // Click schedule button and verify form display
      cy.get(SELECTORS.scheduleBtn).click();
      cy.get(SELECTORS.interviewForm).should('be.visible');

      // Fill in interview details
      cy.get(SELECTORS.typeSelect).select(TEST_INTERVIEW.type);
      cy.get(SELECTORS.modeSelect).select(TEST_INTERVIEW.mode);
      cy.get(SELECTORS.dateInput).type(TEST_INTERVIEW.scheduledAt.toISOString().split('T')[0]);
      cy.get(SELECTORS.timeInput).type('14:00');
      cy.get(SELECTORS.durationInput).type('60');
      cy.get(SELECTORS.interviewerSelect).select(TEST_INTERVIEW.interviewerIds[0]);
      cy.get(SELECTORS.notesInput).type(TEST_INTERVIEW.notes);

      // Submit form and verify API calls
      cy.get(SELECTORS.submitBtn).click();
      cy.wait('@createInterview').its('request.body').should('deep.include', {
        type: TEST_INTERVIEW.type,
        mode: TEST_INTERVIEW.mode,
        duration_minutes: TEST_INTERVIEW.durationMinutes
      });

      // Verify calendar integration
      cy.wait('@createCalendarEvent');

      // Verify success message and list update
      cy.get(SELECTORS.successMsg).should('be.visible');
      cy.get(SELECTORS.listView).should('contain', TEST_INTERVIEW.notes);
    });

    it('should validate required fields', () => {
      cy.get(SELECTORS.scheduleBtn).click();
      cy.get(SELECTORS.submitBtn).click();

      // Verify validation messages
      cy.get('[data-cy=type-error]').should('be.visible');
      cy.get('[data-cy=date-error]').should('be.visible');
      cy.get('[data-cy=interviewer-error]').should('be.visible');
    });
  });

  describe('Interview Rescheduling', () => {
    it('should reschedule an existing interview', () => {
      // Find and click reschedule button
      cy.get('[data-cy=reschedule-btn]').first().click();
      
      // Update date and time
      const newDate = new Date('2024-01-21T15:00:00Z');
      cy.get(SELECTORS.dateInput).clear().type(newDate.toISOString().split('T')[0]);
      cy.get(SELECTORS.timeInput).clear().type('15:00');

      // Submit changes
      cy.get(SELECTORS.submitBtn).click();
      cy.wait('@updateInterview');
      cy.wait('@createCalendarEvent');

      // Verify update
      cy.get(SELECTORS.successMsg).should('be.visible');
      cy.get(SELECTORS.listView).should('contain', '3:00 PM');
    });
  });

  describe('Interview Cancellation', () => {
    it('should cancel an interview with reason', () => {
      // Find and click cancel button
      cy.get(SELECTORS.cancelBtn).first().click();

      // Provide cancellation reason
      cy.get('[data-cy=cancel-reason]').type('Candidate unavailable');
      cy.get('[data-cy=confirm-cancel]').click();

      // Verify cancellation
      cy.wait('@deleteInterview');
      cy.get(SELECTORS.successMsg).should('be.visible');
      cy.get('[data-cy=status-cancelled]').should('be.visible');
    });
  });

  describe('Interview Feedback', () => {
    it('should submit interview feedback', () => {
      // Open feedback form
      cy.get('[data-cy=submit-feedback-btn]').first().click();
      cy.get(SELECTORS.feedbackForm).should('be.visible');

      // Fill feedback form
      cy.get('[data-cy=overall-rating]').select('STRONG_YES');
      cy.get('[data-cy=technical-skills]').type('Excellent problem-solving skills');
      cy.get('[data-cy=communication]').type('Clear and concise communication');
      cy.get('[data-cy=hire-recommendation]').check();

      // Submit feedback
      cy.get('[data-cy=submit-feedback]').click();
      cy.wait('@submitFeedback');

      // Verify submission
      cy.get(SELECTORS.successMsg).should('be.visible');
      cy.get('[data-cy=feedback-submitted]').should('be.visible');
    });
  });

  describe('View Management', () => {
    it('should switch between list and calendar views', () => {
      // Test list view
      cy.get(SELECTORS.listView).should('be.visible');
      
      // Switch to calendar view
      cy.get('[data-cy=view-toggle]').click();
      cy.get(SELECTORS.calendarView).should('be.visible');
      
      // Verify interview appears in calendar
      cy.get('.fc-event').should('be.visible');
    });

    it('should handle timezone conversions correctly', () => {
      cy.get(SELECTORS.scheduleBtn).click();
      
      // Set timezone and verify conversion
      cy.get('[data-cy=timezone-select]').select('America/New_York');
      cy.get(SELECTORS.dateInput).type('2024-01-20');
      cy.get(SELECTORS.timeInput).type('14:00');
      
      // Verify displayed time reflects timezone
      cy.get('[data-cy=utc-time]').should('contain', '19:00');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      cy.get(SELECTORS.scheduleBtn).focus().type('{enter}');
      cy.get(SELECTORS.interviewForm).should('be.visible');
      
      // Test form navigation
      cy.tab().should('have.focus');
      cy.tab().should('have.focus');
      
      // Test ARIA labels
      cy.get(SELECTORS.typeSelect).should('have.attr', 'aria-label');
      cy.get(SELECTORS.submitBtn).should('have.attr', 'aria-label');
    });

    it('should announce status messages', () => {
      cy.get(SELECTORS.scheduleBtn).click();
      cy.get(SELECTORS.submitBtn).click();
      
      // Verify error announcements
      cy.get('[role="alert"]').should('be.visible');
    });
  });
});