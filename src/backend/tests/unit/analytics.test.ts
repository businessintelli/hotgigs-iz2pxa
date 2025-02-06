import { describe, it, expect, beforeEach, afterEach, jest } from 'jest'; // ^29.0.0
import { DashboardStats } from '../../types/analytics';
import { getDashboardStats } from '../../edge-functions/analytics/dashboard';
import { mockUsers } from '../mocks/data';
import { ErrorCode } from '../../types/common';

// Mock Redis client
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    on: jest.fn()
  }));
});

// Mock DataDog metrics
jest.mock('datadog-metrics', () => ({
  monitor: {
    increment: jest.fn(),
    timing: jest.fn()
  }
}));

describe('Analytics Dashboard', () => {
  // Test constants
  const PERFORMANCE_THRESHOLD = 2000; // 2 seconds
  const TEST_DATE_RANGE = {
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-01-31')
  };

  // Mock data
  const mockDashboardStats: DashboardStats = {
    total_jobs: 150,
    active_candidates: 500,
    scheduled_interviews: 45,
    conversion_rate: 28.5,
    time_to_hire: 21.3
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock database pool
    jest.spyOn(global, 'Date').mockImplementation(() => new Date('2024-01-15'));
    
    // Mock database queries
    const mockPool = {
      query: jest.fn().mockImplementation((query) => {
        if (query.includes('total_jobs')) {
          return Promise.resolve({ rows: [{ total_jobs: 150 }] });
        }
        if (query.includes('active_candidates')) {
          return Promise.resolve({ rows: [{ active_candidates: 500 }] });
        }
        if (query.includes('scheduled_interviews')) {
          return Promise.resolve({ rows: [{ scheduled_interviews: 45 }] });
        }
        if (query.includes('funnel')) {
          return Promise.resolve({
            rows: [{
              screen_rate: 75.5,
              interview_rate: 45.2,
              offer_rate: 35.8,
              acceptance_rate: 28.5
            }]
          });
        }
        if (query.includes('avg_days')) {
          return Promise.resolve({ rows: [{ avg_days: 21.3 }] });
        }
        return Promise.resolve({ rows: [] });
      })
    };

    jest.mock('../../config/database', () => ({
      databaseConfig: {
        getPool: () => mockPool
      }
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should retrieve dashboard statistics within performance threshold', async () => {
    const startTime = Date.now();

    const filters = {
      start_date: TEST_DATE_RANGE.start_date,
      end_date: TEST_DATE_RANGE.end_date,
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    const stats = await getDashboardStats(filters);

    const executionTime = Date.now() - startTime;

    // Verify performance
    expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLD);

    // Verify data structure
    expect(stats).toEqual(expect.objectContaining({
      total_jobs: expect.any(Number),
      active_candidates: expect.any(Number),
      scheduled_interviews: expect.any(Number),
      conversion_rate: expect.any(Number),
      time_to_hire: expect.any(Number)
    }));

    // Verify metrics match mock data
    expect(stats).toEqual(mockDashboardStats);
  });

  it('should calculate recruitment metrics accurately', async () => {
    const filters = {
      start_date: TEST_DATE_RANGE.start_date,
      end_date: TEST_DATE_RANGE.end_date,
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    const stats = await getDashboardStats(filters);

    // Verify conversion rates
    expect(stats.conversion_rate).toBe(28.5);
    expect(stats.time_to_hire).toBe(21.3);

    // Verify totals
    expect(stats.total_jobs).toBe(150);
    expect(stats.active_candidates).toBe(500);
    expect(stats.scheduled_interviews).toBe(45);
  });

  it('should handle invalid date ranges appropriately', async () => {
    const invalidFilters = {
      start_date: new Date('2024-02-01'),
      end_date: new Date('2024-01-01'), // End date before start date
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    await expect(getDashboardStats(invalidFilters))
      .rejects
      .toThrow('Invalid date range');
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    const mockPool = {
      query: jest.fn().mockRejectedValue(new Error('Database connection failed'))
    };

    jest.mock('../../config/database', () => ({
      databaseConfig: {
        getPool: () => mockPool
      }
    }));

    const filters = {
      start_date: TEST_DATE_RANGE.start_date,
      end_date: TEST_DATE_RANGE.end_date,
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    await expect(getDashboardStats(filters))
      .rejects
      .toThrow('Database connection failed');
  });

  it('should cache results for repeated queries', async () => {
    const filters = {
      start_date: TEST_DATE_RANGE.start_date,
      end_date: TEST_DATE_RANGE.end_date,
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    // First call - should hit database
    await getDashboardStats(filters);

    // Second call - should hit cache
    await getDashboardStats(filters);

    // Verify cache was used
    expect(jest.mocked(require('ioredis')).mock.instances[0].get)
      .toHaveBeenCalledTimes(2);
  });

  it('should generate time-to-hire metrics with proper aggregation', async () => {
    const filters = {
      start_date: TEST_DATE_RANGE.start_date,
      end_date: TEST_DATE_RANGE.end_date,
      dimensions: [],
      job_types: [],
      departments: [],
      locations: []
    };

    const stats = await getDashboardStats(filters);

    // Verify time-to-hire calculation
    expect(stats.time_to_hire).toBe(21.3);
    expect(stats.time_to_hire).toBeGreaterThan(0);
    expect(stats.time_to_hire).toBeLessThan(365); // Sanity check
  });
});