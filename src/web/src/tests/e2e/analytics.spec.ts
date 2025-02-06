import { test, expect, Page } from '@playwright/test'; // ^1.39.0
import { AxeBuilder } from 'axe-playwright'; // ^1.2.0
import { 
  MetricsData, 
  MetricDimension, 
  ReportType, 
  DashboardStats,
  AnalyticsFilters 
} from '../../types/analytics';

class AnalyticsDashboardPage {
  readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }

  // Page selectors
  private selectors = {
    metricsCards: "[data-testid='metrics-card'][aria-label='Analytics Metric']",
    funnelChart: "[data-testid='recruitment-funnel'][role='img']",
    dataTable: "[data-testid='analytics-table'][role='table']",
    datePicker: "[data-testid='date-range-picker'][role='group']",
    reportButton: "[data-testid='generate-report'][role='button']",
    loadingIndicator: "[data-testid='loading-spinner'][aria-busy='true']",
    errorMessage: "[data-testid='error-message'][role='alert']",
    pagination: "[data-testid='pagination-controls'][role='navigation']",
    sortButtons: "[data-testid='sort-button'][role='button']",
    filterControls: "[data-testid='filter-controls'][role='group']"
  };

  // Performance tracking
  private async measurePerformance(action: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await action();
    return performance.now() - start;
  }

  // Page actions
  async goto() {
    await this.page.goto('/analytics-dashboard');
    await this.page.waitForSelector(this.selectors.metricsCards, { state: 'visible' });
  }

  async waitForDataLoad() {
    await this.page.waitForSelector(this.selectors.loadingIndicator, { state: 'hidden' });
  }

  async getMetricsCardValue(metricName: string): Promise<string> {
    return this.page.locator(`${this.selectors.metricsCards}[data-metric="${metricName}"]`)
      .locator('[data-testid="metric-value"]').innerText();
  }

  async generateReport(reportType: ReportType): Promise<void> {
    await this.page.click(this.selectors.reportButton);
    await this.page.selectOption('[data-testid="report-type"]', reportType);
    await this.page.click('[data-testid="generate"]');
  }
}

test.describe('Analytics Dashboard', () => {
  let dashboardPage: AnalyticsDashboardPage;
  let performanceMetrics: { [key: string]: number[] } = {};

  test.beforeEach(async ({ page }) => {
    dashboardPage = new AnalyticsDashboardPage(page);
    await dashboardPage.goto();
    performanceMetrics = {};
  });

  test.afterEach(async ({ page }) => {
    // Log performance metrics
    Object.entries(performanceMetrics).forEach(([metric, times]) => {
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`${metric} average time: ${average}ms`);
    });

    // Clear test data
    await page.evaluate(() => localStorage.clear());
  });

  test('should display metrics cards with correct data', async ({ page }) => {
    const loadTime = await dashboardPage.measurePerformance(async () => {
      await dashboardPage.waitForDataLoad();
    });
    performanceMetrics['metrics-load'] = [loadTime];
    
    // Verify metrics cards
    const timeToHire = await dashboardPage.getMetricsCardValue('time-to-hire');
    const activeJobs = await dashboardPage.getMetricsCardValue('active-jobs');
    
    expect(Number(timeToHire)).toBeLessThan(60); // Time to hire should be under 60 days
    expect(Number(activeJobs)).toBeGreaterThan(0);

    // Accessibility check
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toHaveLength(0);
  });

  test('should render recruitment funnel chart', async ({ page }) => {
    const chartRenderTime = await dashboardPage.measurePerformance(async () => {
      await page.waitForSelector(dashboardPage['selectors'].funnelChart);
    });
    performanceMetrics['chart-render'] = [chartRenderTime];

    // Verify chart elements
    const chart = page.locator(dashboardPage['selectors'].funnelChart);
    await expect(chart).toBeVisible();
    
    // Test chart interactions
    await chart.hover();
    await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
    
    // Verify data consistency
    const stages = await page.$$eval('[data-testid="funnel-stage"]', 
      elements => elements.map(el => ({
        stage: el.getAttribute('data-stage'),
        value: Number(el.getAttribute('data-value'))
      }))
    );
    
    expect(stages).toBeTruthy();
    expect(stages.length).toBeGreaterThan(0);
    stages.forEach((stage, index) => {
      if (index > 0) {
        expect(stage.value).toBeLessThanOrEqual(stages[index - 1].value);
      }
    });
  });

  test('should handle data table operations', async ({ page }) => {
    // Test sorting
    await page.click(`${dashboardPage['selectors'].sortButtons}[data-column="date"]`);
    const sortTime = await dashboardPage.measurePerformance(async () => {
      await dashboardPage.waitForDataLoad();
    });
    performanceMetrics['sort-operation'] = [sortTime];

    // Test pagination
    await page.click('[data-testid="next-page"]');
    const paginationTime = await dashboardPage.measurePerformance(async () => {
      await dashboardPage.waitForDataLoad();
    });
    performanceMetrics['pagination'] = [paginationTime];

    // Test filtering
    await page.fill('[data-testid="search-input"]', 'Engineering');
    const filterTime = await dashboardPage.measurePerformance(async () => {
      await dashboardPage.waitForDataLoad();
    });
    performanceMetrics['filter-operation'] = [filterTime];

    // Verify table accessibility
    const table = page.locator(dashboardPage['selectors'].dataTable);
    await expect(table).toHaveAttribute('role', 'table');
    await expect(page.locator('th')).toHaveAttribute('scope', 'col');
  });

  test('should manage analytics report generation', async ({ page }) => {
    // Configure report
    await page.click(dashboardPage['selectors'].reportButton);
    await page.selectOption('[data-testid="report-type"]', ReportType.RECRUITMENT_FUNNEL);
    
    // Set date range
    await page.fill('[data-testid="start-date"]', '2023-01-01');
    await page.fill('[data-testid="end-date"]', '2023-12-31');

    // Generate report
    const reportGenTime = await dashboardPage.measurePerformance(async () => {
      await dashboardPage.generateReport(ReportType.RECRUITMENT_FUNNEL);
      await page.waitForSelector('[data-testid="report-download"]');
    });
    performanceMetrics['report-generation'] = [reportGenTime];

    // Verify download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="report-download"]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/analytics-report.*\.pdf$/);

    // Test error handling
    await page.route('**/api/analytics/report', route => route.abort());
    await dashboardPage.generateReport(ReportType.RECRUITMENT_FUNNEL);
    await expect(page.locator(dashboardPage['selectors'].errorMessage)).toBeVisible();
  });

  test('should meet performance benchmarks', async ({ page }) => {
    // Test initial load time
    const loadTime = await dashboardPage.measurePerformance(async () => {
      await page.reload();
      await dashboardPage.waitForDataLoad();
    });
    expect(loadTime).toBeLessThan(2000); // 2 second threshold

    // Test interaction response time
    const interactionTime = await dashboardPage.measurePerformance(async () => {
      await page.click(dashboardPage['selectors'].filterControls);
      await page.waitForResponse(response => 
        response.url().includes('/api/analytics') && response.status() === 200
      );
    });
    expect(interactionTime).toBeLessThan(200); // 200ms threshold
  });
});