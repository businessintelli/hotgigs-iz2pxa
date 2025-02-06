import * as React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupServer } from "msw";

import { CandidateList } from "../../components/candidates/CandidateList";
import { useCandidates } from "../../lib/hooks/useCandidates";
import { handlers } from "../mocks/handlers";
import { CandidateStatus } from "../../types/candidates";
import { PAGINATION_DEFAULTS } from "../../config/constants";

// Setup MSW server
const server = setupServer(...handlers);

// Helper function to render components with required providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe("Candidate List Integration", () => {
  // Setup and teardown
  beforeEach(() => {
    server.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it("renders candidate list with pagination", async () => {
    const user = userEvent.setup();
    const onCandidateSelect = vi.fn();

    renderWithProviders(
      <CandidateList
        candidates={[]}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={3}
        onPageChange={() => {}}
        onCandidateSelect={onCandidateSelect}
        showMatchScore={true}
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /loading/i })).toBeNull();
    });

    // Verify pagination controls
    const pagination = screen.getByRole("navigation", { name: /pagination/i });
    expect(within(pagination).getByText("1")).toHaveAttribute("aria-current", "page");
    expect(within(pagination).getByText("2")).toBeInTheDocument();
    expect(within(pagination).getByText("3")).toBeInTheDocument();
  });

  it("handles loading and error states", async () => {
    // Test loading state
    const { rerender } = renderWithProviders(
      <CandidateList
        candidates={[]}
        isLoading={true}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    );

    expect(screen.getByTestId("candidate-list-skeleton")).toBeInTheDocument();

    // Test error state
    rerender(
      <CandidateList
        candidates={[]}
        isLoading={false}
        error={new Error("Failed to load candidates")}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load candidates");
  });
});

describe("Candidate Operations", () => {
  it("manages candidate lifecycle", async () => {
    const { result } = renderHook(() => useCandidates(), {
      wrapper: ({ children }) => {
        const queryClient = new QueryClient();
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      },
    });

    // Create candidate
    const newCandidate = {
      full_name: "Jane Smith",
      email: "jane.smith@example.com",
      status: CandidateStatus.ACTIVE,
      skills: ["React", "TypeScript"],
      experience_level: "Senior",
    };

    await act(async () => {
      await result.current.createCandidate(newCandidate);
    });

    expect(result.current.candidates[0].full_name).toBe("Jane Smith");

    // Update candidate
    const updateData = {
      experience_level: "Lead",
      skills: ["React", "TypeScript", "Node.js"],
    };

    await act(async () => {
      await result.current.updateCandidate({
        id: result.current.candidates[0].id,
        data: updateData,
      });
    });

    expect(result.current.candidates[0].experience_level).toBe("Lead");

    // Delete candidate
    await act(async () => {
      await result.current.deleteCandidate(result.current.candidates[0].id);
    });

    expect(result.current.candidates).toHaveLength(0);
  });

  it("handles validation and errors", async () => {
    const { result } = renderHook(() => useCandidates(), {
      wrapper: ({ children }) => {
        const queryClient = new QueryClient();
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      },
    });

    // Test invalid data
    const invalidCandidate = {
      full_name: "", // Invalid: empty name
      email: "invalid-email", // Invalid: wrong format
    };

    await act(async () => {
      await expect(result.current.createCandidate(invalidCandidate)).rejects.toThrow();
    });

    expect(result.current.createError?.code).toBe("VALIDATION_ERROR");
  });
});

describe("AI Matching Integration", () => {
  it("performs candidate matching", async () => {
    const { result } = renderHook(() => useCandidates(), {
      wrapper: ({ children }) => {
        const queryClient = new QueryClient();
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      },
    });

    const jobId = "test-job-id";
    
    await act(async () => {
      const matches = await result.current.matchCandidatesToJob({
        jobId,
        filters: {
          skills: ["React", "TypeScript"],
          experience_level: "Senior",
        },
      });

      expect(matches).toHaveLength(3);
      expect(matches[0].match_score).toBeGreaterThan(0);
      expect(matches[0].skill_match_percentage).toBeDefined();
    });
  });

  it("handles AI service errors", async () => {
    server.use(
      rest.post("/api/candidates/match", (_, res, ctx) => {
        return res(
          ctx.status(503),
          ctx.json({ error: "AI service unavailable" })
        );
      })
    );

    const { result } = renderHook(() => useCandidates(), {
      wrapper: ({ children }) => {
        const queryClient = new QueryClient();
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      },
    });

    await act(async () => {
      await expect(
        result.current.matchCandidatesToJob({
          jobId: "test-job-id",
        })
      ).rejects.toThrow();
    });

    expect(result.current.matchError?.code).toBe("SERVICE_UNAVAILABLE");
  });
});