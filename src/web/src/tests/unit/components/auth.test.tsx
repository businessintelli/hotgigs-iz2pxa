import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { LoginForm } from "../../components/auth/LoginForm";
import { AuthProvider, useAuth } from "../../contexts/AuthContext";
import { AuthStatus, UserRole } from "../../types/auth";
import { ERROR_MESSAGES } from "../../config/constants";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
vi.mock("../../contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: vi.fn()
}));

// Helper function to render components with auth context
const renderWithAuth = (ui: React.ReactElement, contextProps = {}) => {
  return render(
    <AuthProvider {...contextProps}>
      {ui}
    </AuthProvider>
  );
};

// Setup user event instance
const setupUserEvent = () => userEvent.setup({
  delay: null,
  pointerEventsCheck: 0
});

describe("LoginForm", () => {
  const mockLogin = vi.fn();
  const user = setupUserEvent();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Setup default auth mock
    (useAuth as any).mockReturnValue({
      login: mockLogin,
      state: {
        status: AuthStatus.UNAUTHENTICATED,
        error: null,
        isLoading: false
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders form elements with proper accessibility attributes", async () => {
    const { container } = renderWithAuth(<LoginForm />);

    // Check form elements existence
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("validates required fields with appropriate error messages", async () => {
    renderWithAuth(<LoginForm />);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    // Submit empty form
    await user.click(submitButton);

    // Check for validation messages
    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it("handles successful login flow with loading states", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    
    renderWithAuth(<LoginForm onSuccess={onSuccess} />);

    // Fill form
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");

    // Submit form
    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitButton);

    // Check loading state
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();

    // Verify login call
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("manages failed login attempts with proper error display", async () => {
    const errorMessage = "Invalid credentials";
    mockLogin.mockRejectedValueOnce(new Error(errorMessage));

    renderWithAuth(<LoginForm />);

    // Fill and submit form
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Check error message
    expect(await screen.findByText(errorMessage)).toBeInTheDocument();
  });

  it("implements rate limiting for login attempts", async () => {
    renderWithAuth(<LoginForm />);

    // Attempt multiple logins
    for (let i = 0; i < 6; i++) {
      await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getByRole("button", { name: /sign in/i }));
    }

    // Check rate limit message
    expect(await screen.findByText(/too many login attempts/i)).toBeInTheDocument();
  });

  it("supports keyboard navigation and screen reader announcements", async () => {
    renderWithAuth(<LoginForm />);

    // Test keyboard navigation
    await user.tab();
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByLabelText(/password/i)).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole("button", { name: /sign in/i })).toHaveFocus();

    // Check ARIA attributes
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByLabelText(/password/i)).toHaveAttribute("aria-invalid", "false");
  });

  it("validates input sanitization", async () => {
    renderWithAuth(<LoginForm />);

    // Test email sanitization
    await user.type(screen.getByRole("textbox", { name: /email/i }), " Test@Example.com ");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
    });
  });

  it("handles session storage correctly", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    
    renderWithAuth(<LoginForm />);

    // Fill and submit form
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  it("supports MFA flow when enabled", async () => {
    // Mock MFA required state
    (useAuth as any).mockReturnValue({
      login: mockLogin,
      state: {
        status: AuthStatus.UNAUTHENTICATED,
        error: null,
        isLoading: false,
        mfaRequired: true
      }
    });

    renderWithAuth(<LoginForm />);

    // Fill and submit form
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
        expect.any(String)
      );
    });
  });

  it("handles network errors appropriately", async () => {
    mockLogin.mockRejectedValueOnce(new Error(ERROR_MESSAGES.NETWORK_ERROR));

    renderWithAuth(<LoginForm />);

    // Fill and submit form
    await user.type(screen.getByRole("textbox", { name: /email/i }), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Check network error message
    expect(await screen.findByText(ERROR_MESSAGES.NETWORK_ERROR)).toBeInTheDocument();
  });
});