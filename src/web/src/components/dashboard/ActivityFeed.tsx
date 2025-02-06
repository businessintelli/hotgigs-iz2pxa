import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import { cn } from '../../lib/utils';
import Loading from '../ui/loading';
import useWebSocket from '../../lib/hooks/useWebSocket';
import type { BaseEntity } from '../../types/common';
import { WEBSOCKET_EVENTS, CHANNEL_NAMES } from '../../config/websocket';

// Activity types and status enums
export enum ActivityType {
  JOB = 'job',
  APPLICATION = 'application',
  INTERVIEW = 'interview',
  CANDIDATE = 'candidate',
  HOTLIST = 'hotlist'
}

export enum ActivityStatus {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// Icon mapping for different activity types
const ACTIVITY_ICONS = {
  [ActivityType.JOB]: 'briefcase',
  [ActivityType.APPLICATION]: 'file-text',
  [ActivityType.INTERVIEW]: 'calendar',
  [ActivityType.CANDIDATE]: 'user',
  [ActivityType.HOTLIST]: 'star'
} as const;

// Status color mapping
const ACTIVITY_COLORS = {
  [ActivityStatus.INFO]: 'text-blue-500',
  [ActivityStatus.SUCCESS]: 'text-green-500',
  [ActivityStatus.WARNING]: 'text-yellow-500',
  [ActivityStatus.ERROR]: 'text-red-500'
} as const;

// Constants
const DEFAULT_LIMIT = 10;
const ANIMATION_DURATION = 300;

// Interface definitions
interface ActivityItem extends BaseEntity {
  type: ActivityType;
  title: string;
  description: string;
  status: ActivityStatus;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  className?: string;
  limit?: number;
  virtualScroll?: boolean;
  wsConfig?: {
    reconnectAttempts?: number;
    reconnectInterval?: number;
  };
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  className,
  limit = DEFAULT_LIMIT,
  virtualScroll = false,
  wsConfig
}) => {
  // State management
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket connection for real-time updates
  const handleMessage = useCallback((payload: any) => {
    if (Object.values(WEBSOCKET_EVENTS).includes(payload.event)) {
      const newActivity: ActivityItem = {
        id: crypto.randomUUID(),
        created_at: new Date(),
        updated_at: new Date(),
        type: mapEventToActivityType(payload.event),
        title: getActivityTitle(payload),
        description: getActivityDescription(payload),
        status: getActivityStatus(payload),
        metadata: payload.payload
      };

      setActivities(prev => [newActivity, ...prev].slice(0, limit));
    }
  }, [limit]);

  const { isConnected, error, connectionStatus } = useWebSocket(
    'CANDIDATES',
    handleMessage
  );

  // Format activity timestamp with proper timezone handling
  const formatActivityTime = useCallback((date: Date): string => {
    try {
      return format(date, 'HH:mm');
    } catch {
      return '';
    }
  }, []);

  // Memoized activity list with proper sorting
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => 
      b.created_at.getTime() - a.created_at.getTime()
    );
  }, [activities]);

  // Activity icon component with proper accessibility
  const ActivityIcon: React.FC<{ type: ActivityType; status: ActivityStatus }> = ({ 
    type, 
    status 
  }) => (
    <div 
      className={cn(
        'rounded-full p-2 bg-background',
        ACTIVITY_COLORS[status]
      )}
      aria-hidden="true"
    >
      <i className={`icon-${ACTIVITY_ICONS[type]} h-4 w-4`} />
    </div>
  );

  // Initial data fetch
  useEffect(() => {
    const fetchInitialActivities = async () => {
      try {
        setIsLoading(true);
        // Fetch logic would go here
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch activities:', err);
        setIsLoading(false);
      }
    };

    fetchInitialActivities();
  }, [limit]);

  if (isLoading) {
    return <Loading size="md" />;
  }

  return (
    <div 
      className={cn(
        'flex flex-col space-y-4 overflow-hidden',
        className
      )}
      role="log"
      aria-label="Activity Feed"
    >
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md" role="alert">
          <p>Failed to connect to real-time updates</p>
          <p className="text-sm">{error.message}</p>
        </div>
      )}

      <div className="space-y-4">
        {sortedActivities.map((activity) => (
          <div
            key={activity.id}
            className={cn(
              'flex items-start space-x-4 p-4 bg-card rounded-lg transition-all duration-300',
              'hover:bg-card/80'
            )}
            role="article"
          >
            <ActivityIcon type={activity.type} status={activity.status} />
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-medium text-foreground">
                  {activity.title}
                </h4>
                <time 
                  className="text-xs text-muted-foreground"
                  dateTime={activity.created_at.toISOString()}
                >
                  {formatActivityTime(activity.created_at)}
                </time>
              </div>
              
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {activity.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!isConnected && (
        <div 
          className="text-sm text-muted-foreground text-center py-2"
          role="status"
        >
          Reconnecting to real-time updates...
        </div>
      )}
    </div>
  );
};

// Utility functions
function mapEventToActivityType(event: string): ActivityType {
  switch (event) {
    case WEBSOCKET_EVENTS.JOB_UPDATE:
      return ActivityType.JOB;
    case WEBSOCKET_EVENTS.APPLICATION_UPDATE:
      return ActivityType.APPLICATION;
    case WEBSOCKET_EVENTS.INTERVIEW_UPDATE:
      return ActivityType.INTERVIEW;
    case WEBSOCKET_EVENTS.CANDIDATE_UPDATE:
      return ActivityType.CANDIDATE;
    case WEBSOCKET_EVENTS.HOTLIST_UPDATE:
      return ActivityType.HOTLIST;
    default:
      return ActivityType.JOB;
  }
}

function getActivityTitle(payload: any): string {
  // Implementation would parse payload and return appropriate title
  return payload.payload?.title || 'Activity Update';
}

function getActivityDescription(payload: any): string {
  // Implementation would parse payload and return appropriate description
  return payload.payload?.description || 'No description available';
}

function getActivityStatus(payload: any): ActivityStatus {
  // Implementation would determine appropriate status based on payload
  return payload.payload?.status === 'error' 
    ? ActivityStatus.ERROR 
    : ActivityStatus.INFO;
}

export default ActivityFeed;