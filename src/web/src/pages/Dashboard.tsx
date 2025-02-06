import React, { Suspense, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { toast } from 'sonner'; // ^1.0.0
import { cn } from '../lib/utils';
import Loading from '../components/ui/loading';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import { useAnalytics } from '../lib/hooks/useAnalytics';
import { DashboardStats, MetricDimension } from '../types/analytics';
import { ERROR_MESSAGES } from '../config/constants';

// Stats card configuration with accessibility attributes
const STATS_CARDS_CONFIG = [
  {
    title: 'Active Jobs',
    icon: 'BriefcaseIcon',
    key: 'total_jobs',
    ariaLabel: 'Number of active job postings',
    description: 'Total number of active job listings'
  },
  {
    title: 'Total Candidates',
    icon: 'UserGroupIcon',
    key: 'active_candidates',
    ariaLabel: 'Total number of candidates',
    description: 'Active candidates in the system'
  },
  {
    title: 'Upcoming Interviews',
    icon: 'CalendarIcon',
    key: 'scheduled_interviews',
    ariaLabel: 'Number of upcoming interviews',
    description: 'Scheduled interviews for next 7 days'
  }
] as const;

// Error fallback component with retry capability
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div 
    className="rounded-lg bg-destructive/10 p-6 text-center"
    role="alert"
    aria-live="polite"
  >
    <h3 className="text-lg font-semibold text-destructive mb-2">
      {ERROR_MESSAGES.GENERIC_ERROR}
    </h3>
    <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="btn btn-secondary"
      aria-label="Retry loading dashboard"
    >
      Try Again
    </button>
  </div>
);

// Stats card component with accessibility and animations
const StatsCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  description: string;
  ariaLabel: string;
}> = ({ title, value, icon, description, ariaLabel }) => (
  <div
    className={cn(
      "rounded-lg bg-card p-6 shadow-sm transition-all duration-200",
      "hover:shadow-md hover:scale-[1.02]"
    )}
    role="region"
    aria-label={ariaLabel}
  >
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">{title}</h3>
      <i className={`icon-${icon} h-5 w-5 text-muted-foreground`} aria-hidden="true" />
    </div>
    <p className="mt-2 text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </div>
);

/**
 * Main dashboard component implementing real-time updates, error boundaries,
 * and accessibility features following WCAG 2.1 AA guidelines.
 */
const Dashboard: React.FC = () => {
  // Analytics hook for dashboard metrics
  const {
    stats,
    isLoading,
    error,
    refetch,
    lastUpdated
  } = useAnalytics().useDashboardStats({
    dimensions: [
      MetricDimension.JOB_TYPE,
      MetricDimension.DEPARTMENT,
      MetricDimension.STAGE
    ]
  });

  // Memoized stats cards data
  const statsCards = useMemo(() => (
    STATS_CARDS_CONFIG.map(config => ({
      ...config,
      value: stats?.[config.key as keyof DashboardStats] || 0
    }))
  ), [stats]);

  // Effect for error notifications
  useEffect(() => {
    if (error) {
      toast.error(ERROR_MESSAGES.GENERIC_ERROR, {
        description: error.message
      });
    }
  }, [error]);

  // Loading state with skeleton
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg bg-card/50 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="h-96 rounded-lg bg-card/50 animate-pulse" aria-hidden="true" />
      </div>
    );
  }

  return (
    <main
      className="container mx-auto p-6 space-y-6"
      aria-label="Dashboard"
    >
      {/* Stats Section */}
      <section aria-label="Key Metrics" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated?.toLocaleTimeString()}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {statsCards.map((card) => (
            <StatsCard
              key={card.key}
              title={card.title}
              value={card.value}
              icon={card.icon}
              description={card.description}
              ariaLabel={card.ariaLabel}
            />
          ))}
        </div>
      </section>

      {/* Activity Feed Section */}
      <section 
        aria-label="Recent Activity"
        className="rounded-lg bg-card p-6"
      >
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={refetch}
        >
          <Suspense fallback={<Loading size="lg" />}>
            <ActivityFeed
              className="h-[500px]"
              limit={10}
              virtualScroll={true}
              wsConfig={{
                reconnectAttempts: 5,
                reconnectInterval: 1000
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </section>
    </main>
  );
};

export default Dashboard;