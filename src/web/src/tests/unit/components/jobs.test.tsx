import * as React from "react" // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react" // ^14.0.0
import { vi } from "vitest" // ^0.34.0
import { QueryClient, QueryClientProvider } from "@tanstack/react-query" // ^4.0.0
import JobCard from "../../components/jobs/JobCard"
import JobList from "../../components/jobs/JobList"
import { Job, JobStatus, JobType, ExperienceLevel } from "../../types/jobs"

// Mock next/router
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock useJobs hook
vi.mock("../../lib/hooks/useJobs", () => ({
  useJobs: () => ({
    useJobSearch: vi.fn(() => ({
      data: {
        pages: [
          {
            data: mockJobList,
            total: mockJobList.length,
            total_pages: 1,
            page: 1,
            limit: 20,
          },
        ],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    })),
    initializeRealTimeUpdates: vi.fn(() => () => {}),
  }),
}))

// Enhanced mock data
const mockJob: Job = {
  id: "123",
  title: "Senior React Developer",
  description: "Exciting opportunity for a senior React developer",
  creator_id: "user123",
  requirements: {
    experience_level: ExperienceLevel.SENIOR,
    years_experience: 5,
    required_skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
    preferred_skills: ["Next.js", "Tailwind"],
    qualifications: ["Bachelor's degree"],
    responsibilities: ["Lead development", "Mentor juniors"],
    certifications: ["AWS Certified"],
    education_requirements: ["Computer Science degree"],
    languages: ["English"],
    skill_proficiency: { React: 90, TypeScript: 85 },
    background_check_required: true,
    tools_and_technologies: ["Git", "JIRA"]
  },
  status: JobStatus.PUBLISHED,
  type: JobType.FULL_TIME,
  skills: ["React", "TypeScript"],
  posted_at: new Date("2023-01-01"),
  closed_at: null,
  salary_min: 120000,
  salary_max: 180000,
  location: "San Francisco",
  remote_allowed: true,
  department: "Engineering",
  benefits: ["Health Insurance", "401k"],
  metadata: {},
  views_count: 150,
  applications_count: 25,
  tags: ["frontend", "senior"],
  is_featured: true,
  expires_at: null,
  created_at: new Date("2023-01-01"),
  updated_at: new Date("2023-01-01")
}

const mockJobList = [mockJob]

// Helper to render with React Query client
const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe("JobCard", () => {
  it("renders job card correctly with all information", () => {
    render(<JobCard job={mockJob} testId="test-job-card" />)

    // Verify title and description
    expect(screen.getByText("Senior React Developer")).toBeInTheDocument()
    expect(screen.getByText(/Exciting opportunity/)).toBeInTheDocument()

    // Verify status badge
    const statusBadge = screen.getByText("published")
    expect(statusBadge).toBeInTheDocument()
    expect(statusBadge).toHaveClass("bg-success")

    // Verify required skills
    mockJob.requirements.required_skills.slice(0, 5).forEach(skill => {
      expect(screen.getByText(skill)).toBeInTheDocument()
    })

    // Verify experience level
    expect(screen.getByText(/senior • 5\+ years/i)).toBeInTheDocument()

    // Verify location and remote status
    expect(screen.getByText(/San Francisco • Remote/)).toBeInTheDocument()

    // Verify salary range
    expect(screen.getByText(/\$120,000 - \$180,000/)).toBeInTheDocument()

    // Verify applications count
    expect(screen.getByText("25 applications")).toBeInTheDocument()
  })

  it("handles click events correctly", () => {
    const handleClick = vi.fn()
    render(<JobCard job={mockJob} onClick={handleClick} testId="test-job-card" />)

    fireEvent.click(screen.getByTestId("test-job-card"))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("displays loading state correctly", () => {
    render(<JobCard job={mockJob} isLoading testId="test-job-card" />)
    expect(screen.getByTestId("test-job-card")).toHaveClass("animate-pulse")
  })

  it("maintains accessibility standards", () => {
    const { container } = render(<JobCard job={mockJob} testId="test-job-card" />)
    
    // Check for proper ARIA labels
    expect(screen.getByLabelText("Active job posting")).toBeInTheDocument()
    expect(screen.getByLabelText("25 applications received")).toBeInTheDocument()
    
    // Verify keyboard navigation
    const card = screen.getByTestId("test-job-card")
    card.focus()
    expect(card).toHaveFocus()
  })
})

describe("JobList", () => {
  const defaultSearchParams = {
    query: "",
    page: 1,
    limit: 20,
    status: [],
    type: [],
    skills: [],
    experience_level: [],
    location: "",
    remote_only: false,
    salary_min: 0,
    salary_max: 0,
    departments: [],
    posted_after: "",
    posted_before: "",
    tags: [],
    featured_only: false,
    sort_by: "",
    sort_direction: "",
    filters: {}
  }

  it("renders job list with items correctly", () => {
    renderWithClient(
      <JobList
        searchParams={defaultSearchParams}
        onSearchParamsChange={vi.fn()}
        testId="test-job-list"
      />
    )

    expect(screen.getByText("Senior React Developer")).toBeInTheDocument()
    expect(screen.getByText(/Exciting opportunity/)).toBeInTheDocument()
  })

  it("handles empty state correctly", () => {
    vi.mocked(useJobs).mockImplementation(() => ({
      useJobSearch: vi.fn(() => ({
        data: { pages: [{ data: [], total: 0, total_pages: 0 }] },
        isFetching: false,
        isError: false,
      })),
      initializeRealTimeUpdates: vi.fn(() => () => {}),
    }))

    renderWithClient(
      <JobList
        searchParams={defaultSearchParams}
        onSearchParamsChange={vi.fn()}
      />
    )

    expect(screen.getByText("No Jobs Found")).toBeInTheDocument()
  })

  it("handles error state correctly", () => {
    vi.mocked(useJobs).mockImplementation(() => ({
      useJobSearch: vi.fn(() => ({
        isError: true,
        isFetching: false,
      })),
      initializeRealTimeUpdates: vi.fn(() => () => {}),
    }))

    renderWithClient(
      <JobList
        searchParams={defaultSearchParams}
        onSearchParamsChange={vi.fn()}
      />
    )

    expect(screen.getByText("Error Loading Jobs")).toBeInTheDocument()
    expect(screen.getByText(/There was a problem/)).toBeInTheDocument()
  })

  it("handles real-time updates correctly", async () => {
    const cleanupMock = vi.fn()
    vi.mocked(useJobs).mockImplementation(() => ({
      useJobSearch: vi.fn(() => ({
        data: { pages: [{ data: mockJobList, total: 1, total_pages: 1 }] },
        isFetching: false,
        isError: false,
      })),
      initializeRealTimeUpdates: vi.fn(() => cleanupMock),
    }))

    const { unmount } = renderWithClient(
      <JobList
        searchParams={defaultSearchParams}
        onSearchParamsChange={vi.fn()}
        enableRealtime
      />
    )

    // Verify cleanup is called on unmount
    unmount()
    expect(cleanupMock).toHaveBeenCalled()
  })

  it("handles pagination correctly", () => {
    const handleSearchParamsChange = vi.fn()
    renderWithClient(
      <JobList
        searchParams={{ ...defaultSearchParams, page: 1 }}
        onSearchParamsChange={handleSearchParamsChange}
      />
    )

    // Simulate page change
    fireEvent.click(screen.getByLabelText("Go to page 2"))
    expect(handleSearchParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 })
    )
  })

  it("maintains responsive layout", () => {
    const { container } = renderWithClient(
      <JobList
        searchParams={defaultSearchParams}
        onSearchParamsChange={vi.fn()}
        viewMode="grid"
      />
    )

    expect(container.firstChild).toHaveClass(
      "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    )
  })
})