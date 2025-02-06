import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { axe } from '@axe-core/react';
import { ChartComponent } from '../../components/analytics/ChartComponent';
import { DataTable } from '../../components/analytics/DataTable';
import { 
  useDashboardStats, 
  useRecruitmentMetrics, 
  useTimeToHireMetrics, 
  useReportGeneration 
} from '../../lib/hooks/useAnalytics';
import { MetricDimension, ReportType, ReportFrequency } from '../../types/analytics';

// Mock data for testing
const mockDashboardStats = {
  total_jobs: 100,
  active_candidates: 500,
  scheduled_interviews: 50,
  conversion_rate: 75,
  time_to_hire: 25,
  trend_data: {
    applications: 150,
    interviews: 45,
    offers: 20
  }
};

const mockMetricsData = [
  {
    id: '1',
    metric_name: 'applications',
    value: 150,
    dimension: MetricDimension.JOB_TYPE,
    timestamp: new Date('2023-01-01'),
    unit: 'count',
    is_validated: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '2',
    metric_name: 'time_to_hire',
    value: 25,
    dimension: MetricDimension.DEPARTMENT,
    timestamp: new Date('2023-01-02'),
    unit: 'days',
    is_validated: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Helper function to setup test environment with QueryClient
const renderWithQueryClient = (component: React.ReactNode) => {
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
      {component}
    </QueryClientProvider>
  );
};

// Helper function to setup WebSocket testing environment
const setupRealtimeTest = () => {
  const mockWebSocket = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  };

  global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);

  return {
    mockWebSocket,
    cleanup: () => {
      vi.clearAllMocks();
      delete global.WebSocket;
    },
  };
};

describe('ChartComponent Integration', () => {
  const { mockWebSocket, cleanup } = setupRealtimeTest();
  
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render line chart with recruitment metrics and handle real-time updates', async () => {
    const { container } = renderWithQueryClient(
      <ChartComponent
        data={mockMetricsData}
        type="line"
        title="Recruitment Metrics"
        height={400}
      />
    );

    // Verify chart rendering
    await waitFor(() => {
      expect(screen.getByText('Recruitment Metrics')).toBeInTheDocument();
    });

    // Verify accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Simulate real-time update
    act(() => {
      mockWebSocket.addEventListener.mock.calls[0][1]({
        data: JSON.stringify({
          metric_name: 'applications',
          value: 160
        })
      });
    });

    // Verify chart update
    await waitFor(() => {
      const updatedValue = screen.getByText('160');
      expect(updatedValue).toBeInTheDocument();
    });
  });

  it('should handle loading states with skeleton animation', () => {
    vi.mock('../../lib/hooks/useAnalytics', () => ({
      useRecruitmentMetrics: () => ({
        isLoading: true,
        data: null,
        error: null
      })
    }));

    renderWithQueryClient(
      <ChartComponent
        data={[]}
        type="bar"
        title="Loading Test"
        height={400}
      />
    );

    const skeleton = screen.getByTestId('chart-skeleton');
    expect(skeleton).toHaveClass('animate-pulse');
  });
});

describe('DataTable Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should render table with dashboard statistics and virtual scrolling', async () => {
    const onSort = vi.fn();
    const onFilter = vi.fn();

    const { container } = renderWithQueryClient(
      <DataTable
        data={mockMetricsData}
        config={{
          enableSorting: true,
          enableFiltering: true,
          enableVirtualization: true,
          pageSize: 20
        }}
        onSort={onSort}
        onFilter={onFilter}
      />
    );

    // Verify table rendering
    expect(screen.getByRole('region')).toBeInTheDocument();

    // Test sorting
    const metricHeader = screen.getByText('Metric');
    fireEvent.click(metricHeader);
    expect(onSort).toHaveBeenCalled();

    // Test filtering
    const filterInput = screen.getByLabelText('Filter by metric_name');
    fireEvent.change(filterInput, { target: { value: 'applications' } });
    expect(onFilter).toHaveBeenCalledWith('metric_name', 'applications');

    // Verify accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle large datasets efficiently', async () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      ...mockMetricsData[0],
      id: i.toString(),
      value: i
    }));

    const { container } = renderWithQueryClient(
      <DataTable
        data={largeDataset}
        config={{
          enableVirtualization: true,
          pageSize: 20,
          height: '400px'
        }}
      />
    );

    // Verify virtual scrolling
    const tableBody = container.querySelector('tbody');
    expect(tableBody?.children.length).toBeLessThan(largeDataset.length);

    // Test scroll performance
    act(() => {
      fireEvent.scroll(container.querySelector('.overflow-auto')!, {
        target: { scrollTop: 1000 }
      });
    });

    // Verify row updates after scroll
    await waitFor(() => {
      const visibleRows = container.querySelectorAll('tbody tr');
      expect(visibleRows.length).toBeGreaterThan(0);
    });
  });
});

describe('Analytics Hooks Integration', () => {
  const queryClient = new QueryClient();
  const { mockWebSocket, cleanup } = setupRealtimeTest();

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('should fetch dashboard statistics with caching', async () => {
    const TestComponent = () => {
      const { stats, isLoading } = useDashboardStats();
      return isLoading ? <div>Loading...</div> : <div>{stats?.total_jobs}</div>;
    };

    renderWithQueryClient(<TestComponent />);

    // Verify loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Verify data fetching
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    // Verify cache hit
    const cachedData = queryClient.getQueryData(['user-profile', 'dashboard-stats']);
    expect(cachedData).toBeTruthy();
  });

  it('should handle report generation with progress tracking', async () => {
    const mockConfig = {
      report_name: 'Test Report',
      type: ReportType.RECRUITMENT_FUNNEL,
      frequency: ReportFrequency.WEEKLY,
      metrics: ['applications', 'time_to_hire'],
      filters: {
        start_date: new Date(),
        end_date: new Date(),
        dimensions: [MetricDimension.JOB_TYPE],
        job_types: [],
        departments: [],
        locations: [],
        include_archived: false
      },
      is_automated: false
    };

    const TestComponent = () => {
      const { generateReport, isGenerating, progress } = useReportGeneration(mockConfig);
      return (
        <button onClick={() => generateReport()} disabled={isGenerating}>
          {isGenerating ? `Generating (${progress}%)` : 'Generate Report'}
        </button>
      );
    };

    renderWithQueryClient(<TestComponent />);

    // Test report generation
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Verify progress updates
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button.textContent).toMatch(/Generating \(\d+%\)/);
    });
  });
});