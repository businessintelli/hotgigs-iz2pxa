import rateLimit from 'express-rate-limit'; // ^7.1.0
import Redis from 'ioredis'; // ^5.3.0
import RedisStore from 'rate-limit-redis'; // ^4.0.0
import { AppError } from '../utils/error-handler';
import { ErrorCode } from '../types/common';
import { getRateLimitConfig } from '../config/security';
import { Logger } from '../utils/logger';

// Initialize logger
const logger = new Logger({ name: 'rate-limiter' });

// Initialize Redis client with error handling
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (error: Error) => {
  logger.error('Redis connection error', { error });
});

/**
 * IP whitelist cache with TTL
 */
const whitelistCache = new Map<string, boolean>();
const WHITELIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if an IP is whitelisted with caching
 */
const isWhitelisted = async (ip: string): Promise<boolean> => {
  // Check cache first
  if (whitelistCache.has(ip)) {
    return whitelistCache.get(ip)!;
  }

  try {
    // Check whitelist in Redis
    const whitelisted = await redis.sismember('rate-limit:whitelist', ip);
    whitelistCache.set(ip, !!whitelisted);
    
    // Set cache expiry
    setTimeout(() => whitelistCache.delete(ip), WHITELIST_CACHE_TTL);
    
    return !!whitelisted;
  } catch (error) {
    logger.error('Whitelist check failed', { error, ip });
    return false;
  }
};

/**
 * Handles rate limit exceeded events with monitoring and retry guidance
 */
const handleRateLimitExceeded = (req: any, res: any, options: any) => {
  const retryAfter = Math.ceil(options.windowMs / 1000);
  
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    userId: req.user?.id,
    path: req.path,
    method: req.method,
    retryAfter
  });

  // Update rate limit violation metrics
  redis.incr('metrics:rate_limit_violations').catch(error => {
    logger.error('Failed to update rate limit metrics', { error });
  });

  throw new AppError(
    'Too many requests, please try again later',
    ErrorCode.FORBIDDEN,
    {
      retryAfter,
      limit: options.max,
      windowMs: options.windowMs
    }
  );
};

/**
 * Creates a rate limiter middleware with distributed state and monitoring
 */
export const createRateLimiter = (
  routeType: keyof typeof getRateLimitConfig,
  options: Partial<typeof rateLimit.Options> = {}
) => {
  const config = getRateLimitConfig(routeType);
  
  const limiter = rateLimit({
    ...config,
    store: new RedisStore({
      // @ts-expect-error - Type mismatch in library
      sendCommand: (...args: string[]) => redis.call(...args),
      prefix: `rate-limit:${routeType}:`
    }),
    keyGenerator: (req) => {
      // Combine IP and user ID for more precise rate limiting
      return `${req.ip}:${req.user?.id || 'anonymous'}`;
    },
    skip: async (req) => {
      // Skip rate limiting for whitelisted IPs
      return await isWhitelisted(req.ip);
    },
    handler: (req, res) => {
      handleRateLimitExceeded(req, res, {
        windowMs: config.windowMs,
        max: config.max
      });
    },
    // Enable headers for monitoring and client guidance
    standardHeaders: true,
    legacyHeaders: false,
    // Custom draft RFC headers
    headerNames: {
      remaining: 'X-RateLimit-Remaining',
      reset: 'X-RateLimit-Reset',
      total: 'X-RateLimit-Limit'
    },
    ...options
  });

  // Wrap limiter to add monitoring
  return async (req: any, res: any, next: any) => {
    try {
      // Track rate limit request metrics
      await redis.incr(`metrics:rate_limit:${routeType}:requests`);
      
      // Apply rate limiting
      await limiter(req, res, next);
    } catch (error) {
      logger.error('Rate limiter error', { error, routeType });
      next(error);
    }
  };
};

export { handleRateLimitExceeded };