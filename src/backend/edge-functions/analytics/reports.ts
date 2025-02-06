import { createClient } from '@supabase/supabase-js'; // ^2.33.0
import dayjs from 'dayjs'; // ^1.11.9
import { z } from 'zod'; // ^3.22.0
import Redis from 'ioredis'; // ^5.3.2
import {
  MetricsData,
  ReportConfig,
  ReportType,
  MetricDimension,
  analyticsFiltersSchema,
  reportConfigSchema,
  metricsDataSchema,
  reportDataSchema,
  AnalyticsFilters,
  ReportData
} from '../../types/analytics';
import { databaseConfig } from '../../config/database';
import { ErrorCode, ApiResponse, ErrorResponse } from '../../types/common';

// Performance monitoring decorator
function withMetrics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      await this.metricsCollector.recordMetric('report_generation_time', duration);
      return result;
    } catch (error) {
      await this.metricsCollector.recordMetric('report_generation_error', 1);
      throw error;
    }
  };
}

// Cache decorator with TTL support
function withCache(ttlSeconds: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `report:${JSON.stringify(args)}`;
      try {
        const cachedData = await this.cacheClient.get(cacheKey);
        if (cachedData) {
          return JSON.parse(cachedData);
        }
        const result = await originalMethod.apply(this, args);
        await this.cacheClient.setex(cacheKey, ttlSeconds, JSON.stringify(result));
        return result;
      } catch (error) {
        console.error('Cache operation failed:', error);
        return await originalMethod.apply(this, args);
      }
    };
  };
}

// Error handling decorator
function withErrorHandling(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Report generation failed',
        details: { error: error.message }
      };
      throw errorResponse;
    }
  };
}

export class ReportGenerator {
  private readonly supabase;
  private readonly dbPool;
  private readonly cacheClient: Redis;
  private readonly metricsCollector;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.dbPool = databaseConfig.getPool();
    this.cacheClient = new Redis(process.env.REDIS_URL!);
    this.metricsCollector = {
      async recordMetric(name: string, value: number) {
        await this.supabase
          .from('metrics')
          .insert({ name, value, timestamp: new Date() });
      }
    };
  }

  @withMetrics
  @withCache(300)
  @withErrorHandling
  async generateRecruitmentFunnel(filters: AnalyticsFilters): Promise<MetricsData[]> {
    // Validate filters
    const validatedFilters = analyticsFiltersSchema.parse(filters);

    const { data, error } = await this.supabase
      .from('applications')
      .select(`
        status,
        count(*),
        jobs (
          department,
          location
        )
      `)
      .gte('created_at', validatedFilters.start_date)
      .lte('created_at', validatedFilters.end_date)
      .in('jobs.department', validatedFilters.departments)
      .in('jobs.location', validatedFilters.locations)
      .groupBy('status, jobs.department, jobs.location');

    if (error) throw error;

    return data.map(row => ({
      metric_name: 'recruitment_funnel',
      value: row.count,
      dimension: MetricDimension.STAGE,
      timestamp: new Date(),
      stage: row.status,
      department: row.jobs.department,
      location: row.jobs.location
    }));
  }

  @withMetrics
  @withCache(600)
  @withErrorHandling
  async generateTimeToHireReport(filters: AnalyticsFilters): Promise<MetricsData[]> {
    const validatedFilters = analyticsFiltersSchema.parse(filters);

    const { data, error } = await this.supabase
      .rpc('calculate_time_to_hire', {
        start_date: validatedFilters.start_date,
        end_date: validatedFilters.end_date,
        departments: validatedFilters.departments,
        locations: validatedFilters.locations
      });

    if (error) throw error;

    return data.map(row => ({
      metric_name: 'time_to_hire',
      value: row.days,
      dimension: MetricDimension.DEPARTMENT,
      timestamp: new Date(),
      department: row.department
    }));
  }
}

@withErrorHandling
export async function generateReport(
  config: ReportConfig,
  filters: AnalyticsFilters
): Promise<ApiResponse<ReportData>> {
  const generator = new ReportGenerator();
  const validatedConfig = reportConfigSchema.parse(config);

  let metrics: MetricsData[];
  switch (validatedConfig.type) {
    case ReportType.RECRUITMENT_FUNNEL:
      metrics = await generator.generateRecruitmentFunnel(filters);
      break;
    case ReportType.TIME_TO_HIRE:
      metrics = await generator.generateTimeToHireReport(filters);
      break;
    default:
      throw new Error(`Unsupported report type: ${validatedConfig.type}`);
  }

  const reportData: ReportData = {
    config: validatedConfig,
    metrics,
    filters
  };

  return {
    success: true,
    data: reportData,
    error: null
  };
}

@withErrorHandling
export async function scheduleReport(config: ReportConfig): Promise<ApiResponse<void>> {
  const validatedConfig = reportConfigSchema.parse(config);
  const generator = new ReportGenerator();

  // Store schedule in database
  const { error } = await generator.supabase
    .from('report_schedules')
    .insert({
      config: validatedConfig,
      next_run: dayjs().add(1, validatedConfig.frequency.toLowerCase()).toDate(),
      status: 'scheduled'
    });

  if (error) throw error;

  return {
    success: true,
    data: null,
    error: null
  };
}

export default {
  generateReport,
  scheduleReport,
  ReportGenerator
};