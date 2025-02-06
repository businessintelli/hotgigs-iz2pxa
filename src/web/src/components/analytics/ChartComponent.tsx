import React, { useMemo, useCallback, memo } from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  Line,
  Bar,
  Area
} from 'recharts'; // ^2.0.0
import { cn } from 'class-variance-authority'; // ^0.7.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { MetricsData, MetricDimension, ChartTheme } from '../../types/analytics';
import { useAnalytics } from '../../lib/hooks/useAnalytics';

// Chart component props interface
interface ChartProps {
  data: MetricsData[];
  type: 'line' | 'bar' | 'area';
  title: string;
  height: number;
  className?: string;
  theme?: ChartTheme;
  animate?: boolean;
  showBrush?: boolean;
  tooltipFormatter?: (value: number) => string;
  onDataPointClick?: (data: MetricsData) => void;
}

// Error fallback component
const ChartErrorFallback = ({ error }: { error: Error }) => (
  <div className="flex items-center justify-center p-4 border border-red-200 rounded-lg bg-red-50">
    <p className="text-red-600">Failed to render chart: {error.message}</p>
  </div>
);

// Loading skeleton component
const ChartSkeleton = ({ height }: { height: number }) => (
  <div 
    className="animate-pulse bg-gray-100 rounded-lg" 
    style={{ height: `${height}px` }}
  />
);

// Format data for chart consumption with memoization
const formatChartData = (data: MetricsData[], theme?: ChartTheme) => {
  return data.map(item => ({
    name: new Date(item.timestamp).toLocaleDateString(),
    value: item.value,
    dimension: item.dimension,
    metric: item.metric_name,
    color: theme?.colors?.[item.dimension] || '#6366F1'
  }));
};

// Factory function to get appropriate chart component
const getChartComponent = (type: 'line' | 'bar' | 'area') => {
  switch (type) {
    case 'line':
      return LineChart;
    case 'bar':
      return BarChart;
    case 'area':
      return AreaChart;
    default:
      return LineChart;
  }
};

// Main chart component with memoization
const ChartComponent: React.FC<ChartProps> = memo(({
  data,
  type,
  title,
  height,
  className,
  theme,
  animate = true,
  showBrush = false,
  tooltipFormatter,
  onDataPointClick
}) => {
  // Memoize formatted data
  const formattedData = useMemo(() => formatChartData(data, theme), [data, theme]);

  // Get appropriate chart component
  const ChartType = useMemo(() => getChartComponent(type), [type]);

  // Memoize click handler
  const handleClick = useCallback((point: any) => {
    if (onDataPointClick && point.activePayload) {
      onDataPointClick(point.activePayload[0].payload);
    }
  }, [onDataPointClick]);

  // Custom tooltip formatter
  const defaultTooltipFormatter = useCallback((value: number) => {
    return tooltipFormatter ? tooltipFormatter(value) : value.toLocaleString();
  }, [tooltipFormatter]);

  // Render appropriate chart element based on type
  const renderChartElement = useCallback(() => {
    const commonProps = {
      type: "monotone",
      dataKey: "value",
      stroke: theme?.colors?.primary || '#6366F1',
      strokeWidth: 2,
      activeDot: { r: 8, onClick: handleClick }
    };

    switch (type) {
      case 'line':
        return <Line {...commonProps} />;
      case 'bar':
        return <Bar {...commonProps} fill={theme?.colors?.primary || '#6366F1'} />;
      case 'area':
        return (
          <Area 
            {...commonProps}
            fill={theme?.colors?.primary || '#6366F1'}
            fillOpacity={0.2}
          />
        );
    }
  }, [type, theme, handleClick]);

  return (
    <ErrorBoundary FallbackComponent={ChartErrorFallback}>
      <div className={cn(
        "w-full rounded-lg bg-white p-4 shadow-sm",
        className
      )}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <ResponsiveContainer width="100%" height={height}>
          <ChartType
            data={formattedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={defaultTooltipFormatter}
            />
            <Tooltip
              formatter={defaultTooltipFormatter}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            {renderChartElement()}
            {showBrush && (
              <Brush
                dataKey="name"
                height={30}
                stroke={theme?.colors?.secondary || '#94A3B8'}
              />
            )}
          </ChartType>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
});

ChartComponent.displayName = 'ChartComponent';

export default ChartComponent;