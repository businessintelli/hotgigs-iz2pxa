import React from 'react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { axe, toHaveNoViolations } from '@testing-library/jest-dom';
import { userEvent } from '@testing-library/user-event';
import ChartComponent from '../../../components/analytics/ChartComponent';
import MetricsCard from '../../../components/analytics/MetricsCard';
import ReportGenerator from '../../../components/analytics/ReportGenerator';
import DataTable from '../../../components/analytics/DataTable';
import { MetricDimension, ReportType, ReportFrequency } from '../../../types/analytics';

// Add jest-dom matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket for real-time updates
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock Performance Observer
const mockPerformanceObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock data generators
const generateMockMetricsData = (count = 5) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `metric-${index}`,
    metric_name: `Test Metric ${index}`,
    value: Math.random() * 100,
    dimension: MetricDimension.JOB_TYPE,
    timestamp: new Date(Date.now() - index * 86400000),
    unit: 'count',
    is_validated: true,
    previous_value: Math.random() * 100,
  }));
};

describe('ChartComponent', () => {
  beforeEach(() => {
    window.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  it('should render without accessibility violations', async () => {
    const { container } = render(
      <ChartComponent
        data={generateMockMetricsData()}
        type="line"
        title="Test Chart"
        height={300}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle responsive resizing', async () => {
    const { rerender } = render(
      <ChartComponent
        data={generateMockMetricsData()}
        type="line"
        title="Test Chart"
        height={300}
      />
    );

    // Simulate resize
    act(() => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /test chart/i })).toBeInTheDocument();
    });
  });

  it('should handle data updates efficiently', async () => {
    const { rerender } = render(
      <ChartComponent
        data={generateMockMetricsData()}
        type="line"
        title="Test Chart"
        height={300}
      />
    );

    const updatedData = generateMockMetricsData(10);
    
    rerender(
      <ChartComponent
        data={updatedData}
        type="line"
        title="Test Chart"
        height={300}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Chart')).toBeInTheDocument();
    });
  });
});

describe('MetricsCard', () => {
  const mockMetric = generateMockMetricsData(1)[0];

  it('should render metric value with correct formatting', () => {
    render(<MetricsCard data={mockMetric} />);
    
    expect(screen.getByText(mockMetric.metric_name)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should handle real-time updates', async () => {
    const { rerender } = render(<MetricsCard data={mockMetric} />);
    
    const updatedMetric = {
      ...mockMetric,
      value: mockMetric.value + 10,
    };

    rerender(<MetricsCard data={updatedMetric} />);
    
    await waitFor(() => {
      const trend = screen.getByRole('status');
      expect(trend).toHaveTextContent(/\d+(\.\d+)?%/);
    });
  });

  it('should maintain accessibility during loading state', async () => {
    const { container } = render(<MetricsCard data={mockMetric} isLoading />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('ReportGenerator', () => {
  const mockConfig = {
    report_name: 'Test Report',
    type: ReportType.RECRUITMENT_FUNNEL,
    frequency: ReportFrequency.DAILY,
    metrics: ['application_rate', 'conversion_rate'],
    filters: {
      start_date: new Date(),
      end_date: new Date(),
      dimensions: [],
      job_types: [],
      departments: [],
      locations: [],
      include_archived: false,
    },
  };

  it('should validate form inputs correctly', async () => {
    const user = userEvent.setup();
    render(<ReportGenerator />);

    await user.type(
      screen.getByLabelText(/report name/i),
      'Test Report'
    );

    await user.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => {
      expect(screen.getByText(/select at least one metric/i)).toBeInTheDocument();
    });
  });

  it('should handle report generation with progress tracking', async () => {
    const onSuccess = vi.fn();
    render(<ReportGenerator onSuccess={onSuccess} initialConfig={mockConfig} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate report/i }));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
        report_name: mockConfig.report_name,
      }));
    });
  });
});

describe('DataTable', () => {
  const mockData = generateMockMetricsData(20);

  it('should handle sorting and filtering', async () => {
    const onSort = vi.fn();
    const onFilter = vi.fn();

    render(
      <DataTable
        data={mockData}
        config={{
          enableSorting: true,
          enableFiltering: true,
        }}
        onSort={onSort}
        onFilter={onFilter}
      />
    );

    // Test sorting
    const metricHeader = screen.getByText(/metric/i);
    await act(async () => {
      fireEvent.click(metricHeader);
    });

    expect(onSort).toHaveBeenCalled();

    // Test filtering
    const filterInput = screen.getByLabelText(/filter by metric/i);
    await act(async () => {
      fireEvent.change(filterInput, { target: { value: 'Test' } });
    });

    expect(onFilter).toHaveBeenCalledWith('metric_name', 'Test');
  });

  it('should handle row selection and export', async () => {
    const onExport = vi.fn();
    
    render(
      <DataTable
        data={mockData}
        config={{
          enableSelection: true,
          enableExport: true,
        }}
        onExport={onExport}
      />
    );

    // Select first row
    const checkbox = screen.getAllByRole('checkbox')[1];
    await act(async () => {
      fireEvent.click(checkbox);
    });

    // Click export button
    const exportButton = screen.getByRole('button', { name: /export selected/i });
    await act(async () => {
      fireEvent.click(exportButton);
    });

    expect(onExport).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: mockData[0].id }),
    ]));
  });

  it('should handle virtualization for large datasets', async () => {
    const largeDataset = generateMockMetricsData(1000);
    
    render(
      <DataTable
        data={largeDataset}
        config={{
          enableVirtualization: true,
          height: '400px',
        }}
      />
    );

    const table = screen.getByRole('region');
    expect(table).toBeInTheDocument();
    
    // Check that not all rows are rendered initially
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeLessThan(largeDataset.length);
  });
});