import { z } from 'zod'; // v3.22.0
import { BaseEntity } from '../types/common';

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

// Enum for metric dimensions
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
  unit: string;
  is_validated: boolean;
}

// Interface for dashboard statistics
export interface DashboardStats extends BaseEntity {
  total_jobs: number;
  active_candidates: number;
  scheduled_interviews: number;
  conversion_rate: number;
  time_to_hire: number;
  trend_data: Record<string, number>;
}

// Interface for analytics filters
export interface AnalyticsFilters {
  start_date: Date;
  end_date: Date;
  dimensions: MetricDimension[];
  job_types: string[];
  departments: string[];
  locations: string[];
  include_archived: boolean;
}

// Interface for report configuration
export interface ReportConfig extends BaseEntity {
  report_name: string;
  type: ReportType;
  frequency: ReportFrequency;
  metrics: string[];
  filters: AnalyticsFilters;
  is_automated: boolean;
}

// Type for metric values with metadata
export type MetricValue = {
  value: number;
  timestamp: Date;
  dimension?: MetricDimension;
  confidence: number;
  unit: string;
};

// Type for metrics API response
export type MetricsResponse = {
  metric_name: string;
  values: MetricValue[];
  total: number;
  error?: string;
  status: 'success' | 'error';
};

// Type for report data structure
export type ReportData = {
  config: ReportConfig;
  metrics: MetricsData[];
  filters: AnalyticsFilters;
  validation_status: boolean;
};

// Zod schema for MetricsData validation
export const metricsDataSchema = z.object({
  metric_name: z.string(),
  value: z.number(),
  dimension: z.nativeEnum(MetricDimension),
  timestamp: z.date(),
  unit: z.string(),
  is_validated: z.boolean()
});

// Zod schema for DashboardStats validation
export const dashboardStatsSchema = z.object({
  total_jobs: z.number().nonnegative(),
  active_candidates: z.number().nonnegative(),
  scheduled_interviews: z.number().nonnegative(),
  conversion_rate: z.number().min(0).max(100),
  time_to_hire: z.number().nonnegative(),
  trend_data: z.record(z.number())
});

// Zod schema for AnalyticsFilters validation
export const analyticsFiltersSchema = z.object({
  start_date: z.date(),
  end_date: z.date(),
  dimensions: z.array(z.nativeEnum(MetricDimension)),
  job_types: z.array(z.string()),
  departments: z.array(z.string()),
  locations: z.array(z.string()),
  include_archived: z.boolean()
});

// Zod schema for ReportConfig validation
export const reportConfigSchema = z.object({
  report_name: z.string(),
  type: z.nativeEnum(ReportType),
  frequency: z.nativeEnum(ReportFrequency),
  metrics: z.array(z.string()),
  filters: analyticsFiltersSchema,
  is_automated: z.boolean()
});

// Zod schema for MetricValue validation
export const metricValueSchema = z.object({
  value: z.number(),
  timestamp: z.date(),
  dimension: z.nativeEnum(MetricDimension).optional(),
  confidence: z.number().min(0).max(1),
  unit: z.string()
});

// Zod schema for MetricsResponse validation
export const metricsResponseSchema = z.object({
  metric_name: z.string(),
  values: z.array(metricValueSchema),
  total: z.number(),
  error: z.string().optional(),
  status: z.enum(['success', 'error'])
});

// Zod schema for ReportData validation
export const reportDataSchema = z.object({
  config: reportConfigSchema,
  metrics: z.array(metricsDataSchema),
  filters: analyticsFiltersSchema,
  validation_status: z.boolean()
});