import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { RealtimeChannel } from '@supabase/supabase-js'; // ^2.38.0
import { supabase } from '../supabase';
import { 
  WEBSOCKET_EVENTS,
  CHANNEL_NAMES,
  REALTIME_CONFIG,
  SUBSCRIPTION_STATUS,
  WebSocketEventPayload,
  ConnectionStatus
} from '../../config/websocket';

/**
 * WebSocket error types for enhanced error handling
 */
type WebSocketError = {
  code: string;
  message: string;
  timestamp: Date;
  retryable: boolean;
};

/**
 * Custom hook for managing WebSocket connections and real-time subscriptions
 * with comprehensive error handling and connection state management.
 * 
 * @param channelName - The name of the channel to subscribe to
 * @param onMessage - Callback function to handle incoming messages
 * @returns Connection state and control functions
 */
export function useWebSocket(
  channelName: keyof typeof CHANNEL_NAMES,
  onMessage: (payload: WebSocketEventPayload) => void
) {
  // Connection state management
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastConnected: null,
    retryCount: 0,
    status: SUBSCRIPTION_STATUS.UNSUBSCRIBED
  });

  /**
   * Creates a new subscription with error handling and retry logic
   */
  const subscribe = useCallback(async () => {
    try {
      setConnectionStatus(prev => ({
        ...prev,
        status: SUBSCRIPTION_STATUS.CONNECTING
      }));

      // Initialize channel with error boundaries
      const newChannel = supabase.channel(CHANNEL_NAMES[channelName], {
        config: {
          broadcast: { ack: true },
          presence: { key: crypto.randomUUID() }
        }
      });

      // Configure channel event handlers
      newChannel
        .on('presence_state_change', () => {
          setIsConnected(true);
          setConnectionStatus(prev => ({
            ...prev,
            isConnected: true,
            lastConnected: new Date(),
            status: SUBSCRIPTION_STATUS.SUBSCRIBED
          }));
        })
        .on('broadcast', { event: '*' }, (payload) => {
          if (Object.values(WEBSOCKET_EVENTS).includes(payload.event)) {
            onMessage(payload as WebSocketEventPayload);
          }
        })
        .on('error', (error) => {
          setError({
            code: 'CHANNEL_ERROR',
            message: error.message,
            timestamp: new Date(),
            retryable: true
          });
          setConnectionStatus(prev => ({
            ...prev,
            status: SUBSCRIPTION_STATUS.ERROR
          }));
        });

      // Subscribe to channel with automatic retry logic
      const subscription = await newChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setChannel(newChannel);
          setRetryCount(0);
          setError(null);
        } else if (status === 'CLOSED') {
          if (retryCount < REALTIME_CONFIG.MAX_RETRIES) {
            setConnectionStatus(prev => ({
              ...prev,
              status: SUBSCRIPTION_STATUS.RECONNECTING
            }));
            // Exponential backoff for retries
            const delay = REALTIME_CONFIG.RETRY_INTERVAL * 
              Math.pow(REALTIME_CONFIG.BACKOFF_MULTIPLIER, retryCount);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              subscribe();
            }, delay);
          } else {
            setError({
              code: 'MAX_RETRIES_EXCEEDED',
              message: 'Maximum retry attempts reached',
              timestamp: new Date(),
              retryable: false
            });
          }
        }
      });

      return subscription;
    } catch (err) {
      setError({
        code: 'SUBSCRIPTION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        timestamp: new Date(),
        retryable: true
      });
      throw err;
    }
  }, [channelName, onMessage, retryCount]);

  /**
   * Safely unsubscribes from the channel with cleanup
   */
  const unsubscribe = useCallback(async () => {
    try {
      if (channel) {
        await channel.unsubscribe();
        setChannel(null);
        setIsConnected(false);
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: false,
          status: SUBSCRIPTION_STATUS.UNSUBSCRIBED
        }));
      }
    } catch (err) {
      setError({
        code: 'UNSUBSCRIBE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to unsubscribe',
        timestamp: new Date(),
        retryable: false
      });
    }
  }, [channel]);

  /**
   * Reconnects to the WebSocket with fresh connection
   */
  const reconnect = useCallback(async () => {
    try {
      await unsubscribe();
      setRetryCount(0);
      await subscribe();
    } catch (err) {
      setError({
        code: 'RECONNECT_ERROR',
        message: err instanceof Error ? err.message : 'Failed to reconnect',
        timestamp: new Date(),
        retryable: true
      });
    }
  }, [subscribe, unsubscribe]);

  // Set up subscription on mount
  useEffect(() => {
    subscribe();

    // Implement heartbeat mechanism
    const heartbeatInterval = setInterval(() => {
      if (channel && isConnected) {
        channel.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { timestamp: new Date().toISOString() }
        });
      }
    }, REALTIME_CONFIG.HEARTBEAT_INTERVAL);

    // Handle visibility change for background tab management
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        reconnect();
      }
    };

    // Handle offline/online events
    const handleOnline = () => {
      if (!isConnected) {
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Cleanup subscriptions and listeners
    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      unsubscribe();
    };
  }, [channelName, subscribe, unsubscribe, reconnect, channel, isConnected]);

  return {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    reconnect,
    connectionStatus
  };
}

export default useWebSocket;