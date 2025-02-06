import * as React from "react" // ^18.0.0
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react" // ^14.0.0
import { describe, it, expect, vi, beforeEach } from "vitest" // ^0.34.0
import { axe } from "@axe-core/react" // ^4.7.0
import CandidateCard from "../../components/candidates/CandidateCard"
import CandidateList from "../../components/candidates/CandidateList"
import { Candidate, CandidateStatus } from "../../types/candidates"

// Mock data generator for consistent test data
const mockCandidate = (overrides?: Partial<Candidate>): Candidate => ({
  id: "test-id-1",
  full_name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  location: "New York, USA",
  status: CandidateStatus.ACTIVE,
  experience_level: "Senior",
  skills: ["React", "TypeScript", "Node.js"],
  experience: [],
  education: [],
  resume_url: "https://example.com/resume.pdf",
  preferences: {
    preferred_job_types: ["Full-time"],
    preferred_locations: ["New York"],
    remote_only: false,
    salary_expectation_min: 100000,
    salary_expectation_max: 150000,
    open_to_relocation: true,
    preferred_industries: ["Technology"],
    industry_experience: ["Software"],
    notice_period_days: 30,
    travel_willingness: "As needed",
    work_authorization: "US Citizen",
    preferred_company_sizes: ["Medium", "Large"],
    preferred_work_schedule: "Regular",
    willing_to_travel: true
  },
  certifications: ["AWS Certified Developer"],
  languages: ["English"],
  social_profiles: {
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe"
  },
  summary: "Experienced software engineer",
  last_active: new Date("2023-01-01"),
  profile_complete: true,
  created_at: new Date("2023-01-01"),
  updated_at: new Date("2023-01-01"),
  ...overrides
})

// Helper to render components with necessary providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui)
}

describe("CandidateCard", () => {
  it("renders candidate information correctly", () => {
    const candidate = mockCandidate()
    renderWithProviders(<CandidateCard candidate={candidate} />)

    expect(screen.getByText(candidate.full_name)).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText(candidate.experience_level)).toBeInTheDocument()
    candidate.skills.forEach(skill => {
      expect(screen.getByText(skill)).toBeInTheDocument()
    })
  })

  it("handles click events correctly", () => {
    const onClickMock = vi.fn()
    const candidate = mockCandidate()
    renderWithProviders(
      <CandidateCard candidate={candidate} onClick={onClickMock} />
    )

    fireEvent.click(screen.getByText(candidate.full_name))
    expect(onClickMock).toHaveBeenCalledWith(candidate.id)
  })

  it("displays match score when provided", () => {
    const candidate = mockCandidate()
    const matchScore = 85
    renderWithProviders(
      <CandidateCard 
        candidate={candidate} 
        showMatchScore={true} 
        matchScore={matchScore} 
      />
    )

    expect(screen.getByText(`${matchScore}%`)).toBeInTheDocument()
  })

  it("shows loading state correctly", () => {
    const candidate = mockCandidate()
    renderWithProviders(
      <CandidateCard candidate={candidate} isLoading={true} />
    )

    expect(screen.getByRole("article")).toHaveAttribute("aria-busy", "true")
  })

  it("meets accessibility standards", async () => {
    const candidate = mockCandidate()
    const { container } = renderWithProviders(
      <CandidateCard candidate={candidate} />
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe("CandidateList", () => {
  const mockCandidates = [
    mockCandidate(),
    mockCandidate({ 
      id: "test-id-2", 
      full_name: "Jane Smith",
      status: CandidateStatus.PASSIVE 
    })
  ]

  it("renders list of candidates correctly", () => {
    renderWithProviders(
      <CandidateList
        candidates={mockCandidates}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    )

    mockCandidates.forEach(candidate => {
      expect(screen.getByText(candidate.full_name)).toBeInTheDocument()
    })
  })

  it("shows loading skeleton when loading", () => {
    renderWithProviders(
      <CandidateList
        candidates={[]}
        isLoading={true}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    )

    expect(screen.getAllByClassName("animate-pulse")).toHaveLength(5)
  })

  it("displays error state correctly", () => {
    const error = new Error("Failed to load candidates")
    renderWithProviders(
      <CandidateList
        candidates={[]}
        isLoading={false}
        error={error}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    )

    expect(screen.getByText("Error Loading Candidates")).toBeInTheDocument()
    expect(screen.getByText(error.message)).toBeInTheDocument()
  })

  it("shows empty state when no candidates", () => {
    renderWithProviders(
      <CandidateList
        candidates={[]}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    )

    expect(screen.getByText("No Candidates Found")).toBeInTheDocument()
  })

  it("handles pagination correctly", () => {
    const onPageChange = vi.fn()
    renderWithProviders(
      <CandidateList
        candidates={mockCandidates}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={2}
        onPageChange={onPageChange}
        onCandidateSelect={() => {}}
      />
    )

    fireEvent.click(screen.getByLabelText("Go to page 2"))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it("handles candidate selection", () => {
    const onCandidateSelect = vi.fn()
    renderWithProviders(
      <CandidateList
        candidates={mockCandidates}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={onCandidateSelect}
      />
    )

    fireEvent.click(screen.getByText(mockCandidates[0].full_name))
    expect(onCandidateSelect).toHaveBeenCalledWith(mockCandidates[0].id)
  })

  it("virtualizes list when enabled", () => {
    const manyCandidates = Array.from({ length: 100 }, (_, i) => 
      mockCandidate({ id: `test-id-${i}`, full_name: `Candidate ${i}` })
    )

    renderWithProviders(
      <CandidateList
        candidates={manyCandidates}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={5}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
        enableVirtualization={true}
      />
    )

    // Only a subset of candidates should be rendered initially
    expect(screen.getAllByRole("article")).toHaveLength(10)
  })

  it("meets accessibility standards", async () => {
    const { container } = renderWithProviders(
      <CandidateList
        candidates={mockCandidates}
        isLoading={false}
        error={null}
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        onCandidateSelect={() => {}}
      />
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})