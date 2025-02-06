import { createContext, useContext, useCallback, useEffect, useState } from 'react'; // ^18.0.0
import useWebSocket from '../lib/hooks/useWebSocket';
import { CHANNEL_NAMES, WEBSOCKET_EVENTS, SUBSCRIPTION_STATUS, WebSocketEventPayload, ConnectionStatus } from '../../config/websocket';

// Type for WebSocket context state
interface WebSocketContextState {
  isConnected: boolean;
  error: WebSocketError | null;
  connectionAttempts: number;
  lastHeartbeat: Date | null;
  subscribeToChannel: (channelName: keyof typeof CHANNEL_NAMES, callback: (payload: WebSocketEventPayload) => void) => void;
  unsubscribeFromChannel: (channelName: keyof typeof CHANNEL_NAMES) => void;
  reconnect: () => Promise<void>;
  getConnectionStatus: () => ConnectionStatus;
}

// Type for WebSocket provider props
interface WebSocketProviderProps {
  children: React.ReactNode;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

// Type for WebSocket errors
interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  retryable: boolean;
}

// Create WebSocket context
const WebSocketContext = createContext<WebSocketContextState | null>(null);

/**
 * WebSocket Provider Component
 * Manages global WebSocket state and subscriptions
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  maxReconnectAttempts = 5,
  heartbeatInterval = 30000
}) => {
  // Channel subscription map
  const channelSubscriptions = new Map<string, (payload: WebSocketEventPayload) => void>();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

  // Initialize WebSocket connection for monitoring
  const {
    isConnected,
    error,
    subscribe,
    unsubscribe,
    reconnect: wsReconnect,
    connectionStatus
  } = useWebSocket('CANDIDATES', () => {}); // Monitor connection using a dummy channel

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((channelName: string, payload: WebSocketEventPayload) => {
    const callback = channelSubscriptions.get(channelName);
    if (callback && payload.event && Object.values(WEBSOCKET_EVENTS).includes(payload.event)) {
      callback(payload);
    }
  }, []);

  /**
   * Subscribe to a specific channel
   */
  const subscribeToChannel = useCallback((
    channelName: keyof typeof CHANNEL_NAMES,
    callback: (payload: WebSocketEventPayload) => void
  ) => {
    if (!Object.keys(CHANNEL_NAMES).includes(channelName)) {
      throw new Error(`Invalid channel name: ${channelName}`);
    }

    channelSubscriptions.set(CHANNEL_NAMES[channelName], callback);
    subscribe();
  }, [subscribe]);

  /**
   * Unsubscribe from a specific channel
   */
  const unsubscribeFromChannel = useCallback((channelName: keyof typeof CHANNEL_NAMES) => {
    channelSubscriptions.delete(CHANNEL_NAMES[channelName]);
    if (channelSubscriptions.size === 0) {
      unsubscribe();
    }
  }, [unsubscribe]);

  /**
   * Reconnect WebSocket with reset state
   */
  const reconnect = useCallback(async () => {
    if (connectionAttempts < maxReconnectAttempts) {
      setConnectionAttempts(prev => prev + 1);
      await wsReconnect();
    }
  }, [connectionAttempts, maxReconnectAttempts, wsReconnect]);

  /**
   * Get current connection status
   */
  const getConnectionStatus = useCallback((): ConnectionStatus => ({
    isConnected,
    lastConnected: lastHeartbeat,
    retryCount: connectionAttempts,
    status: isConnected ? SUBSCRIPTION_STATUS.SUBSCRIBED : SUBSCRIPTION_STATUS.UNSUBSCRIBED
  }), [isConnected, lastHeartbeat, connectionAttempts]);

  // Set up heartbeat interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected) {
        setLastHeartbeat(new Date());
      }
    }, heartbeatInterval);

    return () => clearInterval(interval);
  }, [isConnected, heartbeatInterval]);

  // Reset connection attempts on successful connection
  useEffect(() => {
    if (isConnected) {
      setConnectionAttempts(0);
    }
  }, [isConnected]);

  const contextValue: WebSocketContextState = {
    isConnected,
    error,
    connectionAttempts,
    lastHeartbeat,
    subscribeToChannel,
    unsubscribeFromChannel,
    reconnect,
    getConnectionStatus
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to access WebSocket context
 * @throws {Error} If used outside of WebSocketProvider
 */
export const useWebSocketContext = (): WebSocketContextState => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};