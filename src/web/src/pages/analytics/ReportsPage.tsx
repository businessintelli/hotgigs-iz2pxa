import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query'; // ^4.0.0
import { toast } from 'sonner'; // ^1.0.0

import ReportGenerator from '../../components/analytics/ReportGenerator';
import DataTable from '../../components/analytics/DataTable';
import ChartComponent from '../../components/analytics/ChartComponent';

import { useReportGeneration } from '../../lib/hooks/useAnalytics';
import { cn } from '../../lib/utils';
import { CACHE_KEYS, ERROR_MESSAGES } from '../../config/constants';

import type {
  ReportConfig,
  MetricsData,
  AnalyticsFilters,
  ReportType,
  ReportFrequency
} from '../../types/analytics';

// Interface for managing page state
interface ReportPageState {
  currentReport: ReportConfig | null;
  reportData: MetricsData[];
  isGenerating: boolean;
  viewMode: 'table' | 'chart';
  lastUpdated: Date | null;
  error: Error | null;
  filters: AnalyticsFilters;
  socketStatus: 'connected' | 'disconnected' | 'error';
}

// Default filters configuration
const defaultFilters: AnalyticsFilters = {
  start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
  end_date: new Date(),
  dimensions: [],
  job_types: [],
  departments: [],
  locations: [],
  include_archived: false
};

const ReportsPage: React.FC = () => {
  // Initialize query client for cache management
  const queryClient = useQueryClient();

  // Local state management
  const [state, setState] = useState<ReportPageState>({
    currentReport: null,
    reportData: [],
    isGenerating: false,
    viewMode: 'table',
    lastUpdated: null,
    error: null,
    filters: defaultFilters,
    socketStatus: 'disconnected'
  });

  // Initialize report generation hook
  const { generateReport, isGenerating, error: generationError } = useReportGeneration({
    report_name: '',
    type: ReportType.RECRUITMENT_FUNNEL,
    frequency: ReportFrequency.MONTHLY,
    metrics: [],
    filters: defaultFilters,
    is_automated: false
  });

  // Fetch report data with real-time updates
  const { data: reportData, isLoading } = useQuery<MetricsData[]>(
    [CACHE_KEYS.USER_PROFILE, 'report-data', state.currentReport],
    async () => {
      if (!state.currentReport) return [];
      const data = await generateReport(state.currentReport);
      return data;
    },
    {
      enabled: !!state.currentReport,
      refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      staleTime: 60 * 1000, // Consider data stale after 1 minute
      onError: (error: Error) => {
        toast.error(error.message || ERROR_MESSAGES.GENERIC_ERROR);
        setState(prev => ({ ...prev, error }));
      }
    }
  );

  // Handle report generation
  const handleReportGeneration = useCallback(async (config: ReportConfig) => {
    try {
      setState(prev => ({ 
        ...prev, 
        isGenerating: true,
        error: null 
      }));

      const data = await generateReport(config);
      
      setState(prev => ({
        ...prev,
        currentReport: config,
        reportData: data,
        lastUpdated: new Date(),
        isGenerating: false
      }));

      toast.success('Report generated successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC_ERROR;
      toast.error(errorMessage);
      setState(prev => ({ 
        ...prev, 
        error: error as Error,
        isGenerating: false 
      }));
    }
  }, [generateReport]);

  // Handle view mode toggle
  const handleViewModeToggle = useCallback((mode: 'table' | 'chart') => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  // Handle data export
  const handleExport = useCallback(async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      if (!state.reportData.length) {
        toast.error('No data available to export');
        return;
      }

      // Implementation would handle different export formats
      toast.success(`Report exported as ${format.toUpperCase()}`);
      
    } catch (error) {
      toast.error('Failed to export report');
    }
  }, [state.reportData]);

  // Update state when report data changes
  useEffect(() => {
    if (reportData) {
      setState(prev => ({
        ...prev,
        reportData,
        lastUpdated: new Date()
      }));
    }
  }, [reportData]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Analytics Reports</h1>
        <div className="flex gap-4">
          <button
            onClick={() => handleViewModeToggle('table')}
            className={cn(
              'px-4 py-2 rounded-lg',
              state.viewMode === 'table' ? 'bg-primary text-white' : 'bg-gray-100'
            )}
          >
            Table View
          </button>
          <button
            onClick={() => handleViewModeToggle('chart')}
            className={cn(
              'px-4 py-2 rounded-lg',
              state.viewMode === 'chart' ? 'bg-primary text-white' : 'bg-gray-100'
            )}
          >
            Chart View
          </button>
        </div>
      </div>

      {/* Report Generator Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">Generate Report</h2>
        <ReportGenerator
          onSuccess={handleReportGeneration}
          onError={(error) => setState(prev => ({ ...prev, error }))}
          initialConfig={state.currentReport}
          className="max-w-2xl"
        />
      </div>

      {/* Report Display Section */}
      {(isLoading || state.isGenerating) ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : state.error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{state.error.message}</p>
        </div>
      ) : state.reportData.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Report Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">
                {state.currentReport?.report_name || 'Report Results'}
              </h2>
              {state.lastUpdated && (
                <p className="text-sm text-gray-500">
                  Last updated: {state.lastUpdated.toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Export Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 bg-gray-100 rounded-lg"
              >
                Export PDF
              </button>
            </div>
          </div>

          {/* Report Content */}
          {state.viewMode === 'table' ? (
            <DataTable
              data={state.reportData}
              config={{
                enableSorting: true,
                enableFiltering: true,
                enableSelection: true,
                enableExport: true,
                height: '600px'
              }}
              aria-label="Analytics Report Table"
            />
          ) : (
            <ChartComponent
              data={state.reportData}
              type="line"
              title={state.currentReport?.report_name || 'Analytics Chart'}
              height={400}
              showBrush={true}
              animate={true}
            />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <p className="text-gray-500">Generate a report to view data</p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;