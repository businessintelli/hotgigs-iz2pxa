import React, { useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form'; // ^7.0.0
import { z } from 'zod'; // ^3.22.0
import { toast } from 'sonner'; // ^1.0.0
import { 
  ReportType, 
  ReportFrequency, 
  MetricDimension, 
  ReportConfig, 
  AnalyticsFilters 
} from '../../types/analytics';
import Select from '../ui/select';
import { useReportGeneration } from '../../lib/hooks/useAnalytics';
import { cn, debounce } from '../../lib/utils';

// Form validation schema
const reportFormSchema = z.object({
  report_name: z.string().min(3, 'Report name must be at least 3 characters').max(50, 'Report name cannot exceed 50 characters'),
  type: z.nativeEnum(ReportType),
  frequency: z.nativeEnum(ReportFrequency),
  metrics: z.array(z.string()).min(1, 'Select at least one metric'),
  filters: z.custom<AnalyticsFilters>()
});

type ReportFormData = z.infer<typeof reportFormSchema>;

// Default filters
const defaultFilters: AnalyticsFilters = {
  start_date: new Date(),
  end_date: new Date(),
  dimensions: [],
  job_types: [],
  departments: [],
  locations: [],
  include_archived: false
};

// Component props interface
interface ReportGeneratorProps {
  onSuccess?: (config: ReportConfig) => void;
  onError?: (error: Error) => void;
  initialConfig?: Partial<ReportConfig>;
  className?: string;
  resetOnSubmit?: boolean;
}

// Debounce delay for form updates
const DEBOUNCE_MS = 500;

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  onSuccess,
  onError,
  initialConfig,
  className,
  resetOnSubmit = false
}) => {
  // Initialize form with react-hook-form
  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ReportFormData>({
    defaultValues: {
      report_name: initialConfig?.report_name || '',
      type: initialConfig?.type || ReportType.RECRUITMENT_FUNNEL,
      frequency: initialConfig?.frequency || ReportFrequency.MONTHLY,
      metrics: initialConfig?.metrics || [],
      filters: initialConfig?.filters || defaultFilters
    },
    mode: 'onChange'
  });

  // Watch for report type changes to update available metrics
  const selectedType = watch('type');

  // Initialize report generation hook
  const { generateReport, isGenerating, error: generationError } = useReportGeneration({
    report_name: '',
    type: ReportType.RECRUITMENT_FUNNEL,
    frequency: ReportFrequency.MONTHLY,
    metrics: [],
    filters: defaultFilters,
    is_automated: false
  });

  // Generate report type options
  const reportTypeOptions = useMemo(() => {
    return Object.entries(ReportType).map(([key, value]) => ({
      label: key.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' '),
      value: value,
      description: getReportTypeDescription(value)
    }));
  }, []);

  // Generate frequency options
  const frequencyOptions = useMemo(() => {
    return Object.entries(ReportFrequency).map(([key, value]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
      value: value,
      description: getFrequencyDescription(value)
    }));
  }, []);

  // Generate metric options based on report type
  const metricOptions = useMemo(() => {
    return getMetricOptionsForType(selectedType);
  }, [selectedType]);

  // Handle form submission
  const onSubmit = useCallback(async (data: ReportFormData) => {
    try {
      // Validate form data
      const validatedData = reportFormSchema.parse(data);

      // Generate report configuration
      const reportConfig: ReportConfig = {
        ...validatedData,
        is_automated: false
      };

      // Generate report
      await generateReport(reportConfig);

      // Show success message
      toast.success('Report generated successfully');

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(reportConfig);
      }

      // Reset form if specified
      if (resetOnSubmit) {
        reset();
      }
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
      toast.error(errorMessage);
      
      if (onError && error instanceof Error) {
        onError(error);
      }
    }
  }, [generateReport, onSuccess, onError, reset, resetOnSubmit]);

  // Handle metric selection changes
  const handleMetricChange = useCallback(debounce((selectedMetrics: string[]) => {
    // Validate metric dependencies
    const validatedMetrics = validateMetricDependencies(selectedMetrics, selectedType);
    if (validatedMetrics.length !== selectedMetrics.length) {
      toast.warning('Some metrics require additional dependencies');
    }
  }, DEBOUNCE_MS), [selectedType]);

  return (
    <form 
      onSubmit={handleFormSubmit(onSubmit)} 
      className={cn('space-y-6', className)}
      aria-label="Report Generator Form"
    >
      {/* Report Name Input */}
      <div className="space-y-2">
        <label htmlFor="report_name" className="text-sm font-medium">
          Report Name
          <span className="text-destructive ml-1">*</span>
        </label>
        <Controller
          name="report_name"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              id="report_name"
              className="w-full rounded-md border p-2"
              aria-invalid={!!errors.report_name}
              aria-describedby={errors.report_name ? "report_name_error" : undefined}
            />
          )}
        />
        {errors.report_name && (
          <p id="report_name_error" className="text-sm text-destructive">
            {errors.report_name.message}
          </p>
        )}
      </div>

      {/* Report Type Select */}
      <div className="space-y-2">
        <label htmlFor="type" className="text-sm font-medium">
          Report Type
          <span className="text-destructive ml-1">*</span>
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              id="type"
              options={reportTypeOptions}
              placeholder="Select report type"
              error={errors.type?.message}
              aria-invalid={!!errors.type}
            />
          )}
        />
      </div>

      {/* Report Frequency Select */}
      <div className="space-y-2">
        <label htmlFor="frequency" className="text-sm font-medium">
          Frequency
          <span className="text-destructive ml-1">*</span>
        </label>
        <Controller
          name="frequency"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              id="frequency"
              options={frequencyOptions}
              placeholder="Select frequency"
              error={errors.frequency?.message}
              aria-invalid={!!errors.frequency}
            />
          )}
        />
      </div>

      {/* Metrics Multi-Select */}
      <div className="space-y-2">
        <label htmlFor="metrics" className="text-sm font-medium">
          Metrics
          <span className="text-destructive ml-1">*</span>
        </label>
        <Controller
          name="metrics"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              id="metrics"
              options={metricOptions}
              placeholder="Select metrics"
              isMulti
              error={errors.metrics?.message}
              aria-invalid={!!errors.metrics}
              onChange={(value) => {
                field.onChange(value);
                handleMetricChange(value as string[]);
              }}
            />
          )}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || isGenerating}
        className={cn(
          'w-full rounded-md bg-primary px-4 py-2 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        aria-busy={isSubmitting || isGenerating}
      >
        {isSubmitting || isGenerating ? 'Generating...' : 'Generate Report'}
      </button>

      {/* Error Display */}
      {(generationError || errors.root) && (
        <p role="alert" className="text-sm text-destructive">
          {generationError?.message || errors.root?.message}
        </p>
      )}
    </form>
  );
};

// Helper function to get report type description
function getReportTypeDescription(type: ReportType): string {
  const descriptions: Record<ReportType, string> = {
    [ReportType.RECRUITMENT_FUNNEL]: 'Analysis of candidate progression through recruitment stages',
    [ReportType.TIME_TO_HIRE]: 'Metrics on recruitment cycle duration',
    [ReportType.SOURCE_EFFECTIVENESS]: 'Evaluation of candidate source channels',
    [ReportType.INTERVIEWER_PERFORMANCE]: 'Analysis of interviewer efficiency and feedback',
    [ReportType.CANDIDATE_PIPELINE]: 'Overview of candidate pipeline status and metrics'
  };
  return descriptions[type];
}

// Helper function to get frequency description
function getFrequencyDescription(frequency: ReportFrequency): string {
  const descriptions: Record<ReportFrequency, string> = {
    [ReportFrequency.DAILY]: 'Report generated every day',
    [ReportFrequency.WEEKLY]: 'Report generated every week',
    [ReportFrequency.MONTHLY]: 'Report generated every month',
    [ReportFrequency.QUARTERLY]: 'Report generated every quarter'
  };
  return descriptions[frequency];
}

// Helper function to get metric options based on report type
function getMetricOptionsForType(type: ReportType) {
  // Define metrics for each report type
  const metricsByType: Record<ReportType, Array<{ value: string; label: string; description: string }>> = {
    [ReportType.RECRUITMENT_FUNNEL]: [
      { value: 'application_rate', label: 'Application Rate', description: 'Number of applications per job posting' },
      { value: 'conversion_rate', label: 'Conversion Rate', description: 'Percentage of candidates progressing between stages' },
      { value: 'dropout_rate', label: 'Dropout Rate', description: 'Percentage of candidates dropping out of process' }
    ],
    [ReportType.TIME_TO_HIRE]: [
      { value: 'time_to_offer', label: 'Time to Offer', description: 'Average days from application to offer' },
      { value: 'stage_duration', label: 'Stage Duration', description: 'Average time spent in each stage' },
      { value: 'bottleneck_analysis', label: 'Bottleneck Analysis', description: 'Identification of process delays' }
    ],
    // Add other report types...
    [ReportType.SOURCE_EFFECTIVENESS]: [],
    [ReportType.INTERVIEWER_PERFORMANCE]: [],
    [ReportType.CANDIDATE_PIPELINE]: []
  };

  return metricsByType[type] || [];
}

// Helper function to validate metric dependencies
function validateMetricDependencies(selectedMetrics: string[], reportType: ReportType): string[] {
  // Implementation would check for required dependent metrics
  return selectedMetrics;
}

export default ReportGenerator;