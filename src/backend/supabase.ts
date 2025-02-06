import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'; // ^2.33.0
import { MonitoringService } from '@opentelemetry/api'; // ^1.4.0
import { DATABASE_CONFIG } from './config/database';
import { JWT_CONFIG } from './config/security';
import { ErrorCode } from './types/common';

// Environment validation
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}

// Constants for connection management
const MAX_CONNECTION_RETRIES = 3;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Interface for client options
interface SupabaseOptions {
  autoRefresh?: boolean;
  persistSession?: boolean;
  detectSessionInUrl?: boolean;
  headers?: Record<string, string>;
  realtime?: {
    heartbeat?: number;
    timeout?: number;
  };
}

/**
 * Creates and configures a new Supabase client instance with enhanced security and monitoring
 */
export function createSupabaseClient(options: SupabaseOptions = {}): SupabaseClient {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefresh: true,
        persistSession: false,
        detectSessionInUrl: true,
        storage: undefined, // Disable local storage for security
      },
      db: {
        schema: DATABASE_CONFIG.schema,
      },
      global: {
        headers: {
          'x-application-name': 'hotgigs-platform',
          ...options.headers,
        },
      },
      realtime: {
        params: {
          heartbeat: options.realtime?.heartbeat || 30000,
          timeout: options.realtime?.timeout || 60000,
        },
      },
    }
  );

  return client;
}

/**
 * Enhanced service class for managing Supabase client with comprehensive monitoring
 */
export class SupabaseService {
  private client: SupabaseClient;
  private monitor: MonitoringService;
  private activeChannels: Map<string, RealtimeChannel>;
  private healthCheckInterval: NodeJS.Timeout;
  private connectionRetries: number = 0;

  constructor(options: SupabaseOptions = {}) {
    this.client = createSupabaseClient(options);
    this.activeChannels = new Map();
    this.monitor = new MonitoringService({
      serviceName: 'supabase-client',
      serviceVersion: '1.0.0',
    });

    this.setupHealthCheck();
    this.setupErrorHandling();
  }

  /**
   * Returns the configured Supabase client instance with health check
   */
  public getClient(): SupabaseClient {
    if (!this.isHealthy()) {
      this.reconnect();
    }
    return this.client;
  }

  /**
   * Creates a monitored real-time subscription channel
   */
  public createRealtimeChannel(
    channelName: string,
    options: { retryInterval?: number; maxRetries?: number } = {}
  ): RealtimeChannel {
    if (this.activeChannels.has(channelName)) {
      return this.activeChannels.get(channelName)!;
    }

    const channel = this.client.channel(channelName, {
      config: {
        broadcast: { ack: true, self: false },
        presence: { key: '' },
      },
    });

    channel
      .on('error', (error) => {
        this.monitor.recordError('realtime_error', {
          channelName,
          error: error.message,
        });
        this.handleChannelError(channelName, error, options);
      })
      .on('disconnect', () => {
        this.monitor.recordEvent('channel_disconnect', { channelName });
        this.handleChannelDisconnect(channelName, options);
      });

    this.activeChannels.set(channelName, channel);
    this.monitor.recordEvent('channel_created', { channelName });

    return channel;
  }

  /**
   * Monitors and maintains connection health
   */
  private monitorConnectionHealth(): void {
    try {
      this.client.from('health_check').select('count').single();
      this.connectionRetries = 0;
      this.monitor.recordMetric('connection_health', 1);
    } catch (error) {
      this.monitor.recordError('health_check_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.handleConnectionError();
    }
  }

  /**
   * Sets up periodic health checks
   */
  private setupHealthCheck(): void {
    this.healthCheckInterval = setInterval(
      () => this.monitorConnectionHealth(),
      HEALTH_CHECK_INTERVAL
    );
  }

  /**
   * Configures error handling and monitoring
   */
  private setupErrorHandling(): void {
    this.client.auth.onAuthStateChange((event, session) => {
      this.monitor.recordEvent('auth_state_change', { event });
      if (event === 'SIGNED_OUT') {
        this.cleanupChannels();
      }
    });
  }

  /**
   * Checks if the client connection is healthy
   */
  private isHealthy(): boolean {
    return this.connectionRetries < MAX_CONNECTION_RETRIES;
  }

  /**
   * Handles connection errors and implements retry logic
   */
  private handleConnectionError(): void {
    this.connectionRetries++;
    if (this.connectionRetries >= MAX_CONNECTION_RETRIES) {
      this.monitor.recordEvent('connection_failed', {
        retries: this.connectionRetries,
      });
      throw new Error(ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * Handles channel-specific errors
   */
  private handleChannelError(
    channelName: string,
    error: Error,
    options: { retryInterval?: number; maxRetries?: number }
  ): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      setTimeout(() => {
        channel.subscribe((status) => {
          this.monitor.recordEvent('channel_retry', {
            channelName,
            status,
          });
        });
      }, options.retryInterval || 5000);
    }
  }

  /**
   * Handles channel disconnection events
   */
  private handleChannelDisconnect(
    channelName: string,
    options: { retryInterval?: number; maxRetries?: number }
  ): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      this.monitor.recordEvent('channel_disconnect', { channelName });
      this.reconnectChannel(channelName, options);
    }
  }

  /**
   * Attempts to reconnect a specific channel
   */
  private reconnectChannel(
    channelName: string,
    options: { retryInterval?: number; maxRetries?: number }
  ): void {
    const channel = this.activeChannels.get(channelName);
    if (channel) {
      channel.subscribe((status) => {
        this.monitor.recordEvent('channel_reconnect', {
          channelName,
          status,
        });
      });
    }
  }

  /**
   * Attempts to reconnect the client
   */
  private reconnect(): void {
    this.client = createSupabaseClient({
      realtime: {
        heartbeat: 30000,
        timeout: 60000,
      },
    });
    this.monitor.recordEvent('client_reconnect');
  }

  /**
   * Cleans up all active channels
   */
  private cleanupChannels(): void {
    this.activeChannels.forEach((channel, name) => {
      channel.unsubscribe();
      this.monitor.recordEvent('channel_cleanup', { channelName: name });
    });
    this.activeChannels.clear();
  }

  /**
   * Performs cleanup when service is destroyed
   */
  public destroy(): void {
    clearInterval(this.healthCheckInterval);
    this.cleanupChannels();
    this.monitor.recordEvent('service_destroyed');
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService();