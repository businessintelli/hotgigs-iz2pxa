import { Pool, PoolConfig, ClientConfig } from 'pg'; // ^8.11.0
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // ^2.33.0
import { BaseEntity } from '../types/common';

// Database configuration interface with comprehensive options
interface DatabaseConfiguration extends ClientConfig {
  schema: string;
  statement_timeout: number;
  query_timeout: number;
  application_name: string;
}

// Pool monitoring metrics interface
interface PoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  lastError?: Error;
  lastErrorTimestamp?: Date;
}

// Environment-specific database configuration
const DATABASE_CONFIG: DatabaseConfiguration = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA || 'public',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '5000'),
  application_name: 'hotgigs_backend'
};

// Pool configuration with optimized settings
const POOL_CONFIG: PoolConfig = {
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  allowExitOnIdle: false,
  maxUses: 7500,
  log_statement: process.env.NODE_ENV === 'development' ? 'all' : 'none'
};

/**
 * Database configuration manager with comprehensive monitoring and failover support
 */
export class DatabaseConfig {
  private pool: Pool;
  private readonly config: DatabaseConfiguration;
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingClients: 0
  };

  constructor(options: Partial<DatabaseConfiguration> = {}) {
    this.config = { ...DATABASE_CONFIG, ...options };
    this.validateConfig();
    this.pool = this.createPool();
    this.setupPoolMonitoring();
  }

  /**
   * Validates the database configuration
   * @throws Error if required configuration is missing
   */
  private validateConfig(): void {
    const requiredFields: (keyof DatabaseConfiguration)[] = ['host', 'database', 'user', 'password'];
    const missingFields = requiredFields.filter(field => !this.config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required database configuration: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Creates a new database pool with optimized settings
   */
  private createPool(): Pool {
    const pool = new Pool({
      ...this.config,
      ...POOL_CONFIG
    });

    // Error handling for the pool
    pool.on('error', (err: Error) => {
      this.metrics.lastError = err;
      this.metrics.lastErrorTimestamp = new Date();
      console.error('Unexpected error on idle client', err);
    });

    // Connection error handling
    pool.on('connect', (client) => {
      client.on('error', (err: Error) => {
        console.error('Database client error:', err);
      });
    });

    return pool;
  }

  /**
   * Sets up comprehensive pool monitoring
   */
  private setupPoolMonitoring(): void {
    const updateMetrics = () => {
      this.metrics = {
        ...this.metrics,
        totalConnections: this.pool.totalCount,
        activeConnections: this.pool.activeCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount
      };
    };

    // Update metrics every 5 seconds
    setInterval(updateMetrics, 5000);

    // Monitor for potential connection leaks
    setInterval(() => {
      if (this.metrics.activeConnections > POOL_CONFIG.max * 0.8) {
        console.warn('High number of active connections detected:', this.metrics);
      }
    }, 30000);
  }

  /**
   * Returns the database pool with health check
   */
  public async getPool(): Promise<Pool> {
    try {
      // Perform a simple health check query
      await this.pool.query('SELECT 1');
      return this.pool;
    } catch (error) {
      console.error('Database health check failed:', error);
      // Attempt to create a new pool if the current one is unhealthy
      this.pool.end();
      this.pool = this.createPool();
      return this.pool;
    }
  }

  /**
   * Gracefully closes the database pool
   */
  public async closePool(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      console.error('Error closing database pool:', error);
      throw error;
    }
  }

  /**
   * Returns current pool metrics
   */
  public getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }
}

/**
 * Creates and configures a new database pool
 */
export function createDatabasePool(config: Partial<DatabaseConfiguration> = {}): Pool {
  const dbConfig = new DatabaseConfig(config);
  return dbConfig.getPool();
}

/**
 * Singleton database configuration instance
 */
export const databaseConfig = new DatabaseConfig();

/**
 * Helper function to get a Supabase client with the current configuration
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey, {
    db: {
      schema: DATABASE_CONFIG.schema
    },
    auth: {
      persistSession: false
    }
  });
}

// Type guard for database entities
export function isBaseEntity(obj: unknown): obj is BaseEntity {
  return obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'created_at' in obj;
}