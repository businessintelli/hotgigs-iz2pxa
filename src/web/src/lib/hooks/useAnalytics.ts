import { useQuery, useMutation, useQueryClient, useSubscription } from '@tanstack/react-query'; // ^4.0.0
import { toast } from 'sonner'; // ^1.0.0
import { 
  getDashboardStats, 
  getRecruitmentMetrics, 
  getTimeToHireMetrics, 
  generateReport, 
  subscribeToMetrics 
} from '../../lib/api/analytics';
import { 
  DashboardStats, 
  MetricsData, 
  ReportConfig, 
  AnalyticsFilters, 
  ReportType, 
  ReportFrequency, 
  MetricDimension, 
  TrendData 
} from '../../types/analytics';
import { CACHE_KEYS, ERROR_MESSAGES } from '../../config/constants';

/**
 * Hook for managing real-time dashboard statistics with caching
 */
export function useDashboardStats(filters?: AnalyticsFilters) {
  const queryClient = useQueryClient();

  const { 
    data: stats, 
    isLoading, 
    error, 
    refetch,
    dataUpdatedAt 
  } = useQuery<DashboardStats, Error>({
    queryKey: [CACHE_KEYS.USER_PROFILE, 'dashboard-stats', filters],
    queryFn: () => getDashboardStats(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retry: 3,
    onError: (error) => {
      toast.error(error.message || ERROR_MESSAGES.GENERIC_ERROR);
    }
  });

  // Subscribe to real-time updates
  useSubscription(['dashboard-updates'], {
    onData: (data) => {
      queryClient.setQueryData([CACHE_KEYS.USER_PROFILE, 'dashboard-stats'], data);
    },
    onError: (error) => {
      toast.error('Real-time updates error: ' + error.message);
    }
  });

  return {
    stats,
    isLoading,
    error,
    refetch,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null
  };
}

/**
 * Hook for managing recruitment funnel metrics with trend analysis
 */
export function useRecruitmentMetrics(filters: AnalyticsFilters) {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    dataUpdatedAt
  } = useQuery<{ metrics: MetricsData[]; trends: TrendData[] }, Error>({
    queryKey: [CACHE_KEYS.USER_PROFILE, 'recruitment-metrics', filters],
    queryFn: async () => {
      const metrics = await getRecruitmentMetrics(filters);
      const trends = calculateTrends(metrics);
      return { metrics, trends };
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    retry: 2,
    onError: (error) => {
      toast.error(error.message || ERROR_MESSAGES.GENERIC_ERROR);
    }
  });

  // Subscribe to real-time metric updates
  useSubscription(['recruitment-metrics-updates'], {
    onData: (newData) => {
      queryClient.setQueryData(
        [CACHE_KEYS.USER_PROFILE, 'recruitment-metrics'],
        (oldData: any) => ({
          ...oldData,
          metrics: newData.metrics,
          trends: calculateTrends(newData.metrics)
        })
      );
    },
    onError: (error) => {
      toast.error('Real-time metrics error: ' + error.message);
    }
  });

  return {
    metrics: data?.metrics || [],
    trends: data?.trends || [],
    isLoading,
    error,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null
  };
}

/**
 * Hook for managing time-to-hire analytics with forecasting
 */
export function useTimeToHireMetrics(filters: AnalyticsFilters) {
  const {
    data,
    isLoading,
    error
  } = useQuery<{
    metrics: MetricsData[];
    comparison: MetricsData[];
    forecast: MetricsData[];
  }, Error>({
    queryKey: [CACHE_KEYS.USER_PROFILE, 'time-to-hire', filters],
    queryFn: async () => {
      const metrics = await getTimeToHireMetrics(filters);
      const comparison = generateComparison(metrics);
      const forecast = generateForecast(metrics);
      return { metrics, comparison, forecast };
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    onError: (error) => {
      toast.error(error.message || ERROR_MESSAGES.GENERIC_ERROR);
    }
  });

  return {
    metrics: data?.metrics || [],
    comparison: data?.comparison || [],
    forecast: data?.forecast || [],
    isLoading,
    error
  };
}

/**
 * Hook for managing analytics report generation with progress tracking
 */
export function useReportGeneration(config: ReportConfig) {
  const queryClient = useQueryClient();

  const {
    mutate: generateReportMutation,
    isLoading: isGenerating,
    error
  } = useMutation({
    mutationFn: () => generateReport(config),
    onMutate: () => {
      toast.loading('Generating report...');
    },
    onSuccess: () => {
      toast.success('Report generated successfully');
      queryClient.invalidateQueries([CACHE_KEYS.USER_PROFILE, 'reports']);
    },
    onError: (error: Error) => {
      toast.error(error.message || ERROR_MESSAGES.GENERIC_ERROR);
    }
  });

  const [progress, setProgress] = useState(0);

  const generateReport = async () => {
    try {
      await generateReportMutation();
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  };

  return {
    generateReport,
    isGenerating,
    progress,
    error
  };
}

// Helper function to calculate trend analysis
function calculateTrends(metrics: MetricsData[]): TrendData[] {
  return metrics.map(metric => ({
    metric_name: metric.metric_name,
    trend_value: calculateTrendValue(metric),
    direction: determineTrendDirection(metric),
    confidence: calculateConfidence(metric)
  }));
}

// Helper function to generate historical comparison
function generateComparison(metrics: MetricsData[]): MetricsData[] {
  return metrics.map(metric => ({
    ...metric,
    value: calculateComparisonValue(metric)
  }));
}

// Helper function to generate forecast data
function generateForecast(metrics: MetricsData[]): MetricsData[] {
  return metrics.map(metric => ({
    ...metric,
    value: calculateForecastValue(metric)
  }));
}

// Helper functions for trend calculations
function calculateTrendValue(metric: MetricsData): number {
  // Implementation would depend on business logic
  return 0;
}

function determineTrendDirection(metric: MetricsData): 'up' | 'down' | 'stable' {
  // Implementation would depend on business logic
  return 'stable';
}

function calculateConfidence(metric: MetricsData): number {
  // Implementation would depend on business logic
  return 0.95;
}

function calculateComparisonValue(metric: MetricsData): number {
  // Implementation would depend on business logic
  return metric.value;
}

function calculateForecastValue(metric: MetricsData): number {
  // Implementation would depend on business logic
  return metric.value;
}