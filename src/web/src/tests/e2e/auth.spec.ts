import { AuthState, AuthStatus, UserRole } from '../../types/auth';

// Test data and selectors
const TEST_USERS = {
  admin: {
    email: 'admin@hotgigs.com',
    password: 'Admin123!@#',
    role: UserRole.ADMIN
  },
  recruiter: {
    email: 'recruiter@hotgigs.com',
    password: 'Recruit123!@#',
    role: UserRole.RECRUITER
  },
  candidate: {
    email: 'candidate@example.com',
    password: 'Candidate123!@#',
    role: UserRole.CANDIDATE
  }
};

const SELECTORS = {
  auth: {
    emailInput: '[data-cy=email-input]',
    passwordInput: '[data-cy=password-input]',
    submitButton: '[data-cy=submit-button]',
    rememberMe: '[data-cy=remember-me]',
    errorMessage: '[data-cy=error-message]',
    resetLink: '[data-cy=reset-password-link]'
  },
  nav: {
    adminMenu: '[data-cy=admin-menu]',
    recruiterMenu: '[data-cy=recruiter-menu]',
    candidateMenu: '[data-cy=candidate-menu]'
  }
};

describe('Authentication Flow', () => {
  beforeEach(() => {
    // Reset application state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Intercept auth-related API requests
    cy.intercept('POST', '/api/auth/login').as('loginRequest');
    cy.intercept('POST', '/api/auth/logout').as('logoutRequest');
    cy.intercept('POST', '/api/auth/refresh').as('refreshRequest');
    cy.intercept('GET', '/api/auth/session').as('sessionRequest');
    
    // Visit login page
    cy.visit('/login');
    cy.get(SELECTORS.auth.emailInput).should('be.visible');
  });

  it('should handle successful login flow', () => {
    const user = TEST_USERS.recruiter;

    cy.get(SELECTORS.auth.emailInput).type(user.email);
    cy.get(SELECTORS.auth.passwordInput).type(user.password);
    cy.get(SELECTORS.auth.submitButton).click();

    cy.wait('@loginRequest').its('response.statusCode').should('eq', 200);
    cy.url().should('include', '/dashboard');
    
    // Verify local storage and cookies
    cy.window().its('localStorage')
      .invoke('getItem', 'auth_token')
      .should('exist');
    
    // Verify user menu based on role
    cy.get(SELECTORS.nav.recruiterMenu).should('be.visible');
  });

  it('should handle token management', () => {
    const user = TEST_USERS.admin;

    // Login and verify token storage
    cy.get(SELECTORS.auth.emailInput).type(user.email);
    cy.get(SELECTORS.auth.passwordInput).type(user.password);
    cy.get(SELECTORS.auth.submitButton).click();

    cy.wait('@loginRequest').then((interception) => {
      expect(interception.response?.headers['authorization']).to.exist;
      
      // Verify token refresh mechanism
      cy.clock().tick(45 * 60 * 1000); // Advance 45 minutes
      cy.wait('@refreshRequest')
        .its('response.statusCode')
        .should('eq', 200);
    });
  });

  it('should manage sessions correctly', () => {
    const user = TEST_USERS.candidate;

    // Login with remember me
    cy.get(SELECTORS.auth.emailInput).type(user.email);
    cy.get(SELECTORS.auth.passwordInput).type(user.password);
    cy.get(SELECTORS.auth.rememberMe).check();
    cy.get(SELECTORS.auth.submitButton).click();

    // Verify session persistence
    cy.reload();
    cy.wait('@sessionRequest')
      .its('response.statusCode')
      .should('eq', 200);
    cy.get(SELECTORS.nav.candidateMenu).should('be.visible');

    // Test logout
    cy.get('[data-cy=logout-button]').click();
    cy.wait('@logoutRequest');
    cy.url().should('include', '/login');
  });

  it('should enforce role-based access', () => {
    // Test admin access
    cy.login(TEST_USERS.admin);
    cy.visit('/admin/settings');
    cy.url().should('include', '/admin/settings');

    // Test recruiter restrictions
    cy.login(TEST_USERS.recruiter);
    cy.visit('/admin/settings');
    cy.url().should('include', '/dashboard');
    cy.get(SELECTORS.errorMessage).should('contain', 'Access denied');

    // Test candidate restrictions
    cy.login(TEST_USERS.candidate);
    cy.visit('/recruiter/pipeline');
    cy.url().should('include', '/dashboard');
    cy.get(SELECTORS.errorMessage).should('contain', 'Access denied');
  });

  it('should handle security scenarios', () => {
    // Test XSS prevention
    const xssPayload = '<script>alert("xss")</script>';
    cy.get(SELECTORS.auth.emailInput).type(xssPayload);
    cy.get(SELECTORS.auth.emailInput).should('have.value', xssPayload.replace(/[<>]/g, ''));

    // Test brute force protection
    const invalidUser = {
      email: 'invalid@example.com',
      password: 'wrong'
    };

    for (let i = 0; i < 5; i++) {
      cy.get(SELECTORS.auth.emailInput).clear().type(invalidUser.email);
      cy.get(SELECTORS.auth.passwordInput).clear().type(invalidUser.password);
      cy.get(SELECTORS.auth.submitButton).click();
      cy.wait('@loginRequest');
    }

    // Verify account lockout
    cy.get(SELECTORS.auth.submitButton).should('be.disabled');
    cy.get(SELECTORS.errorMessage).should('contain', 'Account temporarily locked');
  });

  it('should handle password reset flow', () => {
    // Initiate password reset
    cy.get(SELECTORS.auth.resetLink).click();
    cy.url().should('include', '/reset-password');

    const userEmail = TEST_USERS.candidate.email;
    cy.get('[data-cy=reset-email-input]').type(userEmail);
    cy.get('[data-cy=reset-submit-button]').click();

    // Verify reset email sent
    cy.get('[data-cy=reset-confirmation]')
      .should('contain', 'Password reset instructions sent');

    // Mock reset token verification
    const mockResetToken = 'valid-reset-token';
    cy.visit(`/reset-password?token=${mockResetToken}`);

    // Set new password
    const newPassword = 'NewPassword123!@#';
    cy.get('[data-cy=new-password-input]').type(newPassword);
    cy.get('[data-cy=confirm-password-input]').type(newPassword);
    cy.get('[data-cy=reset-submit-button]').click();

    // Verify successful password reset
    cy.url().should('include', '/login');
    cy.get(SELECTORS.errorMessage)
      .should('contain', 'Password successfully reset');
  });
});

// Custom commands for auth testing
Cypress.Commands.add('login', (user: typeof TEST_USERS.admin) => {
  cy.session(user.email, () => {
    cy.visit('/login');
    cy.get(SELECTORS.auth.emailInput).type(user.email);
    cy.get(SELECTORS.auth.passwordInput).type(user.password);
    cy.get(SELECTORS.auth.submitButton).click();
    cy.url().should('include', '/dashboard');
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(user: typeof TEST_USERS.admin): Chainable<void>;
    }
  }
}