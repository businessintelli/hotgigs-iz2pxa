import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { format } from 'date-fns'; // ^2.30.0
import { toast } from 'sonner'; // ^1.0.0
import ChartComponent from '../../components/analytics/ChartComponent';
import DataTable from '../../components/analytics/DataTable';
import MetricsCard from '../../components/analytics/MetricsCard';
import { 
  useDashboardStats, 
  useRecruitmentMetrics, 
  useTimeToHireMetrics, 
  useReportGeneration 
} from '../../lib/hooks/useAnalytics';
import { 
  MetricsData, 
  MetricDimension, 
  AnalyticsFilters, 
  ReportType, 
  ReportConfig 
} from '../../types/analytics';
import { debounce, cn } from '../../lib/utils';

// Props interface for the analytics page
interface AnalyticsPageProps {
  className?: string;
  showFilters?: boolean;
  viewConfig?: {
    enableCharts?: boolean;
    enableTable?: boolean;
    enableExport?: boolean;
  };
  refreshInterval?: number;
}

// Default analytics filters
const defaultFilters: AnalyticsFilters = {
  start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  end_date: new Date(),
  dimensions: [MetricDimension.DEPARTMENT, MetricDimension.JOB_TYPE],
  job_types: [],
  departments: [],
  locations: [],
  include_archived: false
};

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  className,
  showFilters = true,
  viewConfig = {
    enableCharts: true,
    enableTable: true,
    enableExport: true
  },
  refreshInterval = 300000 // 5 minutes
}) => {
  // State management
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [selectedMetric, setSelectedMetric] = useState<MetricsData | null>(null);

  // Analytics hooks
  const { 
    stats: dashboardStats, 
    isLoading: isLoadingStats,
    refetch: refetchStats 
  } = useDashboardStats(filters);

  const {
    metrics: recruitmentMetrics,
    trends: recruitmentTrends,
    isLoading: isLoadingMetrics
  } = useRecruitmentMetrics(filters);

  const {
    metrics: timeToHireMetrics,
    comparison: timeToHireComparison,
    forecast: timeToHireForecast,
    isLoading: isLoadingTimeToHire
  } = useTimeToHireMetrics(filters);

  const {
    generateReport,
    isGenerating,
    progress
  } = useReportGeneration({
    report_name: 'Recruitment Analytics',
    type: ReportType.RECRUITMENT_FUNNEL,
    frequency: 'DAILY',
    metrics: ['time_to_hire', 'conversion_rate', 'source_effectiveness'],
    filters,
    is_automated: false
  } as ReportConfig);

  // Memoized metrics cards data
  const metricsCards = useMemo(() => [
    {
      title: 'Total Jobs',
      value: dashboardStats?.total_jobs || 0,
      trend: dashboardStats?.trend_data?.jobs || 0,
      dimension: MetricDimension.JOB_TYPE
    },
    {
      title: 'Active Candidates',
      value: dashboardStats?.active_candidates || 0,
      trend: dashboardStats?.trend_data?.candidates || 0,
      dimension: MetricDimension.STAGE
    },
    {
      title: 'Time to Hire',
      value: dashboardStats?.time_to_hire || 0,
      trend: dashboardStats?.trend_data?.time_to_hire || 0,
      dimension: MetricDimension.DEPARTMENT
    },
    {
      title: 'Conversion Rate',
      value: dashboardStats?.conversion_rate || 0,
      trend: dashboardStats?.trend_data?.conversion || 0,
      dimension: MetricDimension.SOURCE
    }
  ], [dashboardStats]);

  // Handle filter changes with debouncing
  const handleFilterChange = useCallback(
    debounce((newFilters: Partial<AnalyticsFilters>) => {
      setFilters(prev => ({
        ...prev,
        ...newFilters
      }));
    }, 300),
    []
  );

  // Handle metric card click
  const handleMetricClick = useCallback((metric: MetricsData) => {
    setSelectedMetric(metric);
  }, []);

  // Handle data export
  const handleExport = useCallback(async (selectedData: MetricsData[]) => {
    try {
      await generateReport();
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error('Failed to generate report');
      console.error('Export error:', error);
    }
  }, [generateReport]);

  // Setup periodic refresh
  useEffect(() => {
    const intervalId = setInterval(() => {
      refetchStats();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, refetchStats]);

  return (
    <div className={cn('flex flex-col space-y-6 p-6', className)}>
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Analytics Dashboard
        </h1>
        {showFilters && (
          <div className="flex space-x-4">
            <input
              type="date"
              value={format(filters.start_date, 'yyyy-MM-dd')}
              onChange={(e) => handleFilterChange({ start_date: new Date(e.target.value) })}
              className="px-3 py-2 border rounded-md"
            />
            <input
              type="date"
              value={format(filters.end_date, 'yyyy-MM-dd')}
              onChange={(e) => handleFilterChange({ end_date: new Date(e.target.value) })}
              className="px-3 py-2 border rounded-md"
            />
          </div>
        )}
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricsCards.map((metric, index) => (
          <MetricsCard
            key={index}
            data={{
              metric_name: metric.title,
              value: metric.value,
              dimension: metric.dimension,
              timestamp: new Date(),
              unit: '',
              is_validated: true
            }}
            showTrend={true}
            isLoading={isLoadingStats}
            onMetricClick={handleMetricClick}
          />
        ))}
      </div>

      {/* Charts Section */}
      {viewConfig.enableCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartComponent
            data={recruitmentMetrics}
            type="area"
            title="Recruitment Funnel"
            height={300}
            showBrush={true}
            animate={true}
          />
          <ChartComponent
            data={timeToHireMetrics}
            type="line"
            title="Time to Hire Trends"
            height={300}
            showBrush={true}
            animate={true}
          />
        </div>
      )}

      {/* Detailed Metrics Table */}
      {viewConfig.enableTable && (
        <DataTable
          data={recruitmentMetrics}
          config={{
            enableSorting: true,
            enableFiltering: true,
            enableVirtualization: true,
            enableSelection: viewConfig.enableExport,
            enableExport: viewConfig.enableExport,
            pageSize: 10,
            height: '400px'
          }}
          onExport={handleExport}
          aria-label="Recruitment metrics table"
        />
      )}

      {/* Loading States */}
      {(isLoadingStats || isLoadingMetrics || isLoadingTimeToHire) && (
        <div className="fixed bottom-4 right-4">
          <div className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-lg">
            Loading analytics data...
          </div>
        </div>
      )}

      {/* Export Progress */}
      {isGenerating && (
        <div className="fixed bottom-4 right-4">
          <div className="bg-green-500 text-white px-4 py-2 rounded-md shadow-lg">
            Generating report: {progress}%
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;