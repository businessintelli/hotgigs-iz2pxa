import { supabase } from '../lib/supabase'; // ^2.38.0

/**
 * WebSocket event types for real-time updates
 */
export const WEBSOCKET_EVENTS = {
  CANDIDATE_UPDATE: 'candidate_status_change',
  JOB_UPDATE: 'job_update',
  INTERVIEW_UPDATE: 'interview_scheduled',
  APPLICATION_UPDATE: 'application_status_change',
  HOTLIST_UPDATE: 'hotlist_update'
} as const;

/**
 * Channel names for Supabase Realtime subscriptions
 */
export const CHANNEL_NAMES = {
  CANDIDATES: 'public:candidates',
  JOBS: 'public:jobs',
  INTERVIEWS: 'public:interviews',
  APPLICATIONS: 'public:applications',
  HOTLISTS: 'public:hotlists'
} as const;

/**
 * Configuration settings for WebSocket connection management
 */
export const REALTIME_CONFIG = {
  RETRY_INTERVAL: 1000, // Retry connection after 1 second
  MAX_RETRIES: 5, // Maximum number of reconnection attempts
  HEARTBEAT_INTERVAL: 30000, // Send heartbeat every 30 seconds
  CONNECTION_TIMEOUT: 10000, // Connection timeout after 10 seconds
  BACKOFF_MULTIPLIER: 1.5 // Exponential backoff multiplier for retries
} as const;

/**
 * Enum for tracking subscription states
 */
export enum SUBSCRIPTION_STATUS {
  SUBSCRIBED = 'SUBSCRIBED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  ERROR = 'ERROR',
  CONNECTING = 'CONNECTING',
  RECONNECTING = 'RECONNECTING'
}

/**
 * Type definitions for WebSocket event payloads
 */
export type WebSocketEventPayload<T = unknown> = {
  event: keyof typeof WEBSOCKET_EVENTS;
  payload: T;
  timestamp: string;
};

/**
 * Type definitions for subscription options
 */
export interface SubscriptionOptions {
  event: keyof typeof WEBSOCKET_EVENTS;
  filter?: string;
  callback: (payload: WebSocketEventPayload) => void;
  errorHandler?: (error: Error) => void;
}

/**
 * Type guard to check if a payload is a valid WebSocket event
 */
export function isWebSocketEvent(event: string): event is keyof typeof WEBSOCKET_EVENTS {
  return Object.values(WEBSOCKET_EVENTS).includes(event as any);
}

/**
 * Type definitions for channel configuration
 */
export interface ChannelConfig {
  name: keyof typeof CHANNEL_NAMES;
  filter?: string;
  eventTypes: Array<keyof typeof WEBSOCKET_EVENTS>;
}

/**
 * Type for WebSocket connection status
 */
export type ConnectionStatus = {
  isConnected: boolean;
  lastConnected: Date | null;
  retryCount: number;
  status: SUBSCRIPTION_STATUS;
};

/**
 * Type for subscription handlers
 */
export interface SubscriptionHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onReconnecting?: () => void;
  onSubscribed?: () => void;
  onUnsubscribed?: () => void;
}

/**
 * Type for realtime presence state
 */
export interface PresenceState {
  online: boolean;
  lastSeen: Date;
  userId: string;
  clientId: string;
}

/**
 * Type for broadcast message
 */
export interface BroadcastMessage<T = unknown> {
  type: keyof typeof WEBSOCKET_EVENTS;
  payload: T;
  channel: keyof typeof CHANNEL_NAMES;
  timestamp: Date;
}

/**
 * Type for subscription filter
 */
export type SubscriptionFilter = {
  event: string;
  schema?: string;
  table?: string;
  filter?: string;
};

/**
 * Type for channel subscription state
 */
export interface ChannelState {
  name: keyof typeof CHANNEL_NAMES;
  status: SUBSCRIPTION_STATUS;
  subscribers: number;
  lastEvent?: WebSocketEventPayload;
  filter?: SubscriptionFilter;
}