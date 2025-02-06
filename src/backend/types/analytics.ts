import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from './common';

// Enum for different types of analytics reports
export enum ReportType {
  RECRUITMENT_FUNNEL = 'RECRUITMENT_FUNNEL',
  TIME_TO_HIRE = 'TIME_TO_HIRE',
  SOURCE_EFFECTIVENESS = 'SOURCE_EFFECTIVENESS',
  INTERVIEWER_PERFORMANCE = 'INTERVIEWER_PERFORMANCE',
  CANDIDATE_PIPELINE = 'CANDIDATE_PIPELINE'
}

// Enum for report generation frequency
export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

// Enum for metric analysis dimensions
export enum MetricDimension {
  JOB_TYPE = 'JOB_TYPE',
  DEPARTMENT = 'DEPARTMENT',
  LOCATION = 'LOCATION',
  SOURCE = 'SOURCE',
  STAGE = 'STAGE'
}

// Interface for metrics data points
export interface MetricsData extends BaseEntity {
  metric_name: string;
  value: number;
  dimension: MetricDimension;
  timestamp: Date;
}

// Interface for report configuration
export interface ReportConfig extends BaseEntity {
  report_name: string;
  type: ReportType;
  frequency: ReportFrequency;
  metrics: string[];
  filters: Record<string, unknown>;
}

// Interface for dashboard statistics
export interface DashboardStats extends BaseEntity {
  total_jobs: number;
  active_candidates: number;
  scheduled_interviews: number;
  conversion_rate: number;
  time_to_hire: number;
}

// Interface for analytics filters
export interface AnalyticsFilters {
  start_date: Date;
  end_date: Date;
  dimensions: MetricDimension[];
  job_types: string[];
  departments: string[];
  locations: string[];
}

// Type for metric values with metadata
export type MetricValue = {
  value: number;
  timestamp: Date;
  dimension?: MetricDimension;
};

// Type for metrics API response
export type MetricsResponse = {
  metric_name: string;
  values: MetricValue[];
  total: number;
};

// Type for report data structure
export type ReportData = {
  config: ReportConfig;
  metrics: MetricsData[];
  filters: AnalyticsFilters;
};

// Zod schema for MetricDimension validation
export const metricDimensionSchema = z.nativeEnum(MetricDimension);

// Zod schema for ReportType validation
export const reportTypeSchema = z.nativeEnum(ReportType);

// Zod schema for ReportFrequency validation
export const reportFrequencySchema = z.nativeEnum(ReportFrequency);

// Zod schema for MetricsData validation
export const metricsDataSchema = z.object({
  metric_name: z.string(),
  value: z.number(),
  dimension: metricDimensionSchema,
  timestamp: z.date()
});

// Zod schema for ReportConfig validation
export const reportConfigSchema = z.object({
  report_name: z.string(),
  type: reportTypeSchema,
  frequency: reportFrequencySchema,
  metrics: z.array(z.string()),
  filters: z.record(z.unknown())
});

// Zod schema for DashboardStats validation
export const dashboardStatsSchema = z.object({
  total_jobs: z.number(),
  active_candidates: z.number(),
  scheduled_interviews: z.number(),
  conversion_rate: z.number(),
  time_to_hire: z.number()
});

// Zod schema for AnalyticsFilters validation
export const analyticsFiltersSchema = z.object({
  start_date: z.date(),
  end_date: z.date(),
  dimensions: z.array(metricDimensionSchema),
  job_types: z.array(z.string()),
  departments: z.array(z.string()),
  locations: z.array(z.string())
});

// Zod schema for MetricValue validation
export const metricValueSchema = z.object({
  value: z.number(),
  timestamp: z.date(),
  dimension: metricDimensionSchema.optional()
});

// Zod schema for MetricsResponse validation
export const metricsResponseSchema = z.object({
  metric_name: z.string(),
  values: z.array(metricValueSchema),
  total: z.number()
});

// Zod schema for ReportData validation
export const reportDataSchema = z.object({
  config: reportConfigSchema,
  metrics: z.array(metricsDataSchema),
  filters: analyticsFiltersSchema
});