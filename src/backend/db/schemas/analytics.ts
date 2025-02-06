import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from '../../types/common';
import { 
  MetricsData, 
  MetricDimension, 
  ReportType, 
  ReportFrequency 
} from '../../types/analytics';

// Constants for table names and configuration
const METRICS_TABLE_NAME = 'analytics.metrics';
const REPORTS_TABLE_NAME = 'analytics.reports';
const DASHBOARD_STATS_TABLE_NAME = 'analytics.dashboard_stats';
const PARTITION_INTERVAL = '1 month';
const MATERIALIZED_VIEW_REFRESH_INTERVAL = '1 hour';

/**
 * Creates the metrics table schema with time-based partitioning
 * and performance optimizations for analytics data storage
 */
const createMetricsTable = () => {
  return z.object({
    ...z.object(BaseEntity),
    metric_name: z.string().min(1),
    value: z.number(),
    dimension: z.nativeEnum(MetricDimension),
    timestamp: z.date(),
    metadata: z.record(z.unknown()).optional(),
    partition_key: z.date(), // Used for time-based partitioning
  }).extend({
    tableName: z.literal(METRICS_TABLE_NAME),
    partitionConfig: z.object({
      interval: z.literal(PARTITION_INTERVAL),
      key: z.literal('partition_key'),
      strategy: z.literal('RANGE'),
    }),
    indexes: z.array(z.object({
      name: z.string(),
      columns: z.array(z.string()),
      type: z.enum(['btree', 'brin']),
      where: z.string().optional(),
    })).default([
      {
        name: 'idx_metrics_name_dimension_timestamp',
        columns: ['metric_name', 'dimension', 'timestamp'],
        type: 'btree'
      },
      {
        name: 'idx_metrics_timestamp',
        columns: ['timestamp'],
        type: 'brin'
      }
    ])
  });
};

/**
 * Creates the reports table schema with materialized view support
 * for efficient analytics reporting and caching
 */
const createReportsTable = () => {
  return z.object({
    ...z.object(BaseEntity),
    report_name: z.string().min(1),
    type: z.nativeEnum(ReportType),
    frequency: z.nativeEnum(ReportFrequency),
    metrics: z.array(z.string()),
    filters: z.record(z.unknown()),
    last_generated: z.date(),
    next_generation: z.date(),
    is_active: z.boolean(),
  }).extend({
    tableName: z.literal(REPORTS_TABLE_NAME),
    viewConfig: z.object({
      materialized: z.boolean().default(true),
      refreshInterval: z.literal(MATERIALIZED_VIEW_REFRESH_INTERVAL),
      refreshPolicy: z.enum(['ON_DEMAND', 'SCHEDULED']).default('SCHEDULED'),
    }),
    indexes: z.array(z.object({
      name: z.string(),
      columns: z.array(z.string()),
      type: z.enum(['btree', 'hash']),
    })).default([
      {
        name: 'idx_reports_type_frequency',
        columns: ['type', 'frequency'],
        type: 'btree'
      },
      {
        name: 'idx_reports_next_generation',
        columns: ['next_generation'],
        type: 'btree'
      }
    ])
  });
};

/**
 * Creates the dashboard statistics table schema with real-time
 * update capabilities for live analytics monitoring
 */
const createDashboardStatsTable = () => {
  return z.object({
    ...z.object(BaseEntity),
    total_jobs: z.number().nonnegative(),
    active_candidates: z.number().nonnegative(),
    scheduled_interviews: z.number().nonnegative(),
    conversion_rate: z.number().min(0).max(100),
    time_to_hire: z.number().nonnegative(),
    last_updated: z.date(),
    update_frequency: z.string(),
    is_stale: z.boolean(),
  }).extend({
    tableName: z.literal(DASHBOARD_STATS_TABLE_NAME),
    realtimeConfig: z.object({
      enabled: z.boolean().default(true),
      updateTrigger: z.object({
        events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])),
        condition: z.string().optional(),
      }),
      notificationChannel: z.string().default('dashboard_stats_updates'),
      cacheStrategy: z.object({
        ttl: z.number().default(300), // 5 minutes
        invalidationEvents: z.array(z.string()),
      }),
    }),
    indexes: z.array(z.object({
      name: z.string(),
      columns: z.array(z.string()),
      type: z.enum(['btree']),
    })).default([
      {
        name: 'idx_dashboard_stats_last_updated',
        columns: ['last_updated'],
        type: 'btree'
      }
    ])
  });
};

// Export schema definitions with their configurations
export const metricsSchema = createMetricsTable();
export const reportsSchema = createReportsTable();
export const dashboardStatsSchema = createDashboardStatsTable();

// Export type definitions derived from schemas
export type MetricsTableSchema = z.infer<typeof metricsSchema>;
export type ReportsTableSchema = z.infer<typeof reportsSchema>;
export type DashboardStatsTableSchema = z.infer<typeof dashboardStatsSchema>;