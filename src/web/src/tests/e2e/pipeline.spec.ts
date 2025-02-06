import { ApplicationStatus } from '../../types/candidates';

describe('Pipeline View', () => {
  // Test data constants
  const TEST_CANDIDATES = [
    {
      id: 'test-candidate-1',
      full_name: 'John Doe',
      status: ApplicationStatus.APPLIED,
      role: 'Software Engineer',
      email: 'john@example.com',
      applied_date: '2024-01-15T10:00:00Z',
      last_updated: '2024-01-15T10:00:00Z'
    },
    {
      id: 'test-candidate-2',
      full_name: 'Jane Smith',
      status: ApplicationStatus.SCREENING,
      role: 'Product Manager',
      email: 'jane@example.com',
      applied_date: '2024-01-14T09:00:00Z',
      last_updated: '2024-01-15T11:00:00Z'
    }
  ];

  // Selectors object for maintainable element selection
  const selectors = {
    board: '[data-testid=pipeline-board]',
    column: '[data-testid=pipeline-column]',
    card: '[data-testid=candidate-card]',
    columnTitle: '[data-testid=column-title]',
    cardTitle: '[data-testid=card-title]',
    cardBadge: '[data-testid=card-badge]',
    errorMessage: '[data-testid=error-message]',
    loadingState: '[data-testid=loading-spinner]',
    dragHandle: '[data-testid=drag-handle]',
    columnCount: '[data-testid=column-count]'
  };

  beforeEach(() => {
    // Reset database state and seed test data
    cy.task('db:reset');
    cy.task('db:seed', { candidates: TEST_CANDIDATES });

    // Login and navigate to pipeline view
    cy.login('recruiter@hotgigs.io', 'test-password');
    cy.visit('/pipeline');

    // Wait for initial data load
    cy.get(selectors.board).should('be.visible');
    cy.get(selectors.loadingState).should('not.exist');

    // Set up WebSocket connection mock
    cy.intercept('GET', '/realtime*', (req) => {
      req.reply({ statusCode: 101, headers: { 'Upgrade': 'websocket' } });
    });
  });

  it('should render pipeline columns correctly', () => {
    // Verify all pipeline stages are present
    const stages = [
      ApplicationStatus.APPLIED,
      ApplicationStatus.SCREENING,
      ApplicationStatus.INTERVIEW,
      ApplicationStatus.OFFER
    ];

    stages.forEach(stage => {
      cy.get(selectors.column)
        .contains(stage)
        .should('be.visible')
        .closest(selectors.column)
        .should('have.attr', 'data-column-id', stage);
    });

    // Verify column counts
    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.APPLIED}"]`)
      .find(selectors.columnCount)
      .should('contain', '1');
  });

  it('should handle drag and drop operations', () => {
    // Start dragging operation
    cy.get(`${selectors.card}[data-candidate-id="test-candidate-1"]`)
      .find(selectors.dragHandle)
      .trigger('mousedown', { button: 0 })
      .trigger('mousemove', { clientX: 500, clientY: 0 })
      .wait(200); // Wait for drag animation

    // Verify drag visual feedback
    cy.get(`${selectors.card}[data-candidate-id="test-candidate-1"]`)
      .should('have.class', 'dragging');

    // Drop into new column
    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.SCREENING}"]`)
      .trigger('mousemove')
      .trigger('mouseup');

    // Verify card moved to new column
    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.SCREENING}"]`)
      .find(selectors.card)
      .should('have.attr', 'data-candidate-id', 'test-candidate-1');

    // Verify API call was made
    cy.wait('@updateCandidateStatus')
      .its('request.body')
      .should('deep.equal', {
        candidate_id: 'test-candidate-1',
        new_status: ApplicationStatus.SCREENING
      });
  });

  it('should handle drag and drop with error states', () => {
    // Mock network error
    cy.intercept('PATCH', '/api/candidates/*/status', {
      statusCode: 500,
      body: {
        error: 'Failed to update candidate status'
      },
      delay: 1000
    }).as('failedStatusUpdate');

    // Attempt drag operation
    cy.get(`${selectors.card}[data-candidate-id="test-candidate-1"]`)
      .find(selectors.dragHandle)
      .trigger('mousedown', { button: 0 })
      .trigger('mousemove', { clientX: 500, clientY: 0 });

    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.SCREENING}"]`)
      .trigger('mousemove')
      .trigger('mouseup');

    // Verify error message
    cy.get(selectors.errorMessage)
      .should('be.visible')
      .and('contain', 'Failed to update candidate status');

    // Verify card returns to original position
    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.APPLIED}"]`)
      .find(selectors.card)
      .should('have.attr', 'data-candidate-id', 'test-candidate-1');
  });

  it('should maintain accessibility standards', () => {
    // Check ARIA labels
    cy.get(selectors.board)
      .should('have.attr', 'role', 'application')
      .and('have.attr', 'aria-label', 'Recruitment Pipeline Board');

    // Verify keyboard navigation
    cy.get(selectors.card).first().focus()
      .type('{space}')
      .should('have.class', 'selected')
      .type('{rightarrow}')
      .should('have.attr', 'aria-grabbed', 'true');

    // Test screen reader announcements
    cy.get(selectors.column).each(($col) => {
      cy.wrap($col)
        .should('have.attr', 'role', 'region')
        .and('have.attr', 'aria-labelledby');
    });

    // Check color contrast
    cy.get(selectors.cardBadge).each(($badge) => {
      cy.wrap($badge)
        .should('have.css', 'background-color')
        .and(($color) => {
          expect($color).to.satisfy((c: string) => {
            // Verify WCAG 2.1 AA contrast ratio
            return c.match(/^rgb\((\d+,\s*){2}\d+\)$/);
          });
        });
    });
  });

  it('should handle real-time updates', () => {
    // Mock WebSocket message for candidate update
    const wsMessage = {
      type: 'candidate_update',
      payload: {
        candidate_id: 'test-candidate-2',
        new_status: ApplicationStatus.INTERVIEW,
        updated_by: 'other-recruiter@hotgigs.io'
      }
    };

    // Trigger WebSocket message
    cy.window().then((win) => {
      win.postMessage({ type: 'MOCK_WS_MESSAGE', data: wsMessage }, '*');
    });

    // Verify UI updates
    cy.get(`${selectors.column}[data-column-id="${ApplicationStatus.INTERVIEW}"]`)
      .find(selectors.card)
      .should('have.attr', 'data-candidate-id', 'test-candidate-2');

    // Verify notification
    cy.get('[data-testid=notification]')
      .should('be.visible')
      .and('contain', 'Candidate status updated by other-recruiter@hotgigs.io');
  });

  it('should handle mobile responsive behavior', () => {
    // Test mobile viewport
    cy.viewport('iphone-x');

    // Verify column stacking
    cy.get(selectors.board)
      .should('have.css', 'flex-direction', 'column');

    // Test touch interactions
    cy.get(selectors.card).first()
      .trigger('touchstart')
      .trigger('touchmove', { touches: [{ clientX: 100, clientY: 200 }] })
      .trigger('touchend');

    // Verify mobile-specific UI elements
    cy.get('[data-testid=mobile-stage-selector]')
      .should('be.visible');
  });
});