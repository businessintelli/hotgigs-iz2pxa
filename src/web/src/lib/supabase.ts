import { createClient, SupabaseClient } from '@supabase/supabase-js'; // ^2.38.0
import { SUPABASE_URL, SUPABASE_ANON_KEY, WEBSOCKET_CONFIG } from '../config/constants';
import { BaseEntity } from '../types/common';

// Database schema type definition
interface Database {
  public: {
    Tables: {
      jobs: BaseEntity & {
        title: string;
        description: string;
        requirements: object;
        status: 'open' | 'closed' | 'draft';
        creator_id: string;
      };
      candidates: BaseEntity & {
        email: string;
        full_name: string;
        status: 'active' | 'inactive' | 'archived';
        metadata: object;
      };
      interviews: BaseEntity & {
        application_id: string;
        schedule_time: string;
        type: 'technical' | 'hr' | 'final';
        feedback: object;
        status: 'scheduled' | 'completed' | 'cancelled';
      };
      hotlists: BaseEntity & {
        name: string;
        owner_id: string;
        description: string;
        is_private: boolean;
      };
      analytics: BaseEntity & {
        metric_name: string;
        metric_value: number;
        metadata: object;
      };
    };
    Views: {
      candidate_matches: {
        candidate_id: string;
        job_id: string;
        match_score: number;
        match_factors: object;
      };
      job_statistics: {
        job_id: string;
        total_applications: number;
        interview_conversion_rate: number;
        time_to_fill: number;
      };
    };
    Functions: {
      match_candidates: (job_id: string) => Promise<{ candidate_id: string; score: number; }[]>;
      calculate_match_score: (candidate_id: string, job_id: string) => Promise<number>;
    };
    Enums: {
      job_status: 'open' | 'closed' | 'draft';
      interview_status: 'scheduled' | 'completed' | 'cancelled';
      candidate_status: 'active' | 'inactive' | 'archived';
    };
  };
}

/**
 * Validates required Supabase environment variables
 * @throws {Error} If validation fails
 */
function validateEnvironment(): void {
  if (!SUPABASE_URL || !SUPABASE_URL.startsWith('https://')) {
    throw new Error('Invalid or missing SUPABASE_URL. Must be a valid HTTPS URL.');
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 30) {
    throw new Error('Invalid or missing SUPABASE_ANON_KEY.');
  }

  try {
    new URL(SUPABASE_URL);
  } catch (error) {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }
}

/**
 * Initializes and returns a production-ready typed Supabase client instance
 * with comprehensive error handling and connection management
 */
function initSupabase(): SupabaseClient<Database> {
  // Validate environment variables
  validateEnvironment();

  // Client configuration options
  const options = {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window?.localStorage,
    },
    global: {
      headers: {
        'x-application-name': 'hotgigs-web',
        'x-application-version': process.env.VITE_APP_VERSION || '1.0.0',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  };

  // Create client instance
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, options);

  // Configure realtime subscription handlers
  client.realtime.setAuth(SUPABASE_ANON_KEY);
  client.realtime.connect();

  // Configure automatic reconnection
  let retryCount = 0;
  client.realtime.on('disconnected', () => {
    if (retryCount < WEBSOCKET_CONFIG.maxRetries) {
      setTimeout(() => {
        client.realtime.connect();
        retryCount++;
      }, WEBSOCKET_CONFIG.reconnectInterval);
    }
  });

  client.realtime.on('connected', () => {
    retryCount = 0;
  });

  // Configure heartbeat to maintain connection
  setInterval(() => {
    if (client.realtime.isConnected()) {
      client.realtime.send({
        type: 'heartbeat',
        event: 'ping',
      });
    }
  }, WEBSOCKET_CONFIG.heartbeatInterval);

  // Add request interceptor for monitoring
  const { fetch: originalFetch } = client;
  client.fetch = async (input, init) => {
    const startTime = performance.now();
    try {
      const response = await originalFetch(input, init);
      const endTime = performance.now();
      
      // Log request metrics in production
      if (process.env.NODE_ENV === 'production') {
        console.debug('Supabase request:', {
          url: typeof input === 'string' ? input : input.url,
          duration: endTime - startTime,
          status: response.status,
        });
      }
      
      return response;
    } catch (error) {
      // Log errors in production
      if (process.env.NODE_ENV === 'production') {
        console.error('Supabase request error:', error);
      }
      throw error;
    }
  };

  return client;
}

// Export singleton instance
export const supabase = initSupabase();

// Export type for use in other modules
export type TypedSupabaseClient = SupabaseClient<Database>;