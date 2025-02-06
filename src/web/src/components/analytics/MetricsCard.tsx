import * as React from "react"; // ^18.0.0
import { cn } from "../../lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { MetricsData, MetricDimension } from "../../types/analytics";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "lucide-react"; // ^0.11.0

interface MetricsCardProps {
  data: MetricsData;
  className?: string;
  showTrend?: boolean;
  tooltipText?: string;
  isLoading?: boolean;
  onMetricClick?: (metric: MetricsData) => void;
}

const formatValue = (value: number, dimension: MetricDimension): string => {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  switch (dimension) {
    case MetricDimension.SOURCE:
    case MetricDimension.STAGE:
      return formatter.format(value);
    case MetricDimension.DEPARTMENT:
    case MetricDimension.JOB_TYPE:
      return formatter.format(value);
    case MetricDimension.LOCATION:
      return formatter.format(value);
    default:
      return formatter.format(value);
  }
};

const calculateTrendPercentage = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const TrendIndicator: React.FC<{ current: number; previous: number }> = React.memo(
  ({ current, previous }) => {
    const percentage = calculateTrendPercentage(current, previous);
    const isPositive = percentage > 0;
    const isNeutral = percentage === 0;

    return (
      <div
        className={cn(
          "flex items-center space-x-1 text-sm font-medium",
          isPositive ? "text-green-600" : isNeutral ? "text-gray-500" : "text-red-600"
        )}
        role="status"
        aria-label={`Trend: ${isPositive ? "Up" : isNeutral ? "Stable" : "Down"} ${Math.abs(
          percentage
        ).toFixed(1)}%`}
      >
        {isPositive ? (
          <ArrowUpIcon className="h-4 w-4" />
        ) : isNeutral ? (
          <MinusIcon className="h-4 w-4" />
        ) : (
          <ArrowDownIcon className="h-4 w-4" />
        )}
        <span>{Math.abs(percentage).toFixed(1)}%</span>
      </div>
    );
  }
);

TrendIndicator.displayName = "TrendIndicator";

const MetricsCard: React.FC<MetricsCardProps> = React.memo(
  ({ data, className, showTrend = true, tooltipText, isLoading, onMetricClick }) => {
    const handleClick = React.useCallback(() => {
      if (onMetricClick) {
        onMetricClick(data);
      }
    }, [data, onMetricClick]);

    return (
      <Card
        className={cn(
          "transition-all duration-200 hover:shadow-md",
          onMetricClick && "cursor-pointer",
          className
        )}
        onClick={handleClick}
        role="button"
        tabIndex={onMetricClick ? 0 : undefined}
        aria-label={`${data.metric_name} metric card`}
      >
        <CardHeader>
          <CardTitle
            className="text-sm font-medium text-gray-500 dark:text-gray-400"
            title={tooltipText}
          >
            {data.metric_name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {formatValue(data.value, data.dimension)}
              </div>
              {showTrend && data.previous_value !== undefined && (
                <TrendIndicator current={data.value} previous={data.previous_value} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

MetricsCard.displayName = "MetricsCard";

export default MetricsCard;