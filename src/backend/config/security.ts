import { config } from 'dotenv'; // ^16.3.1
import { ErrorCode } from '../types/common';
import crypto from 'crypto';

// Load environment variables
config();

// Validate required environment variables
if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY || !process.env.ENCRYPTION_KEY) {
  throw new Error('Missing required security environment variables');
}

// JWT Configuration
export const JWT_CONFIG = {
  algorithm: 'RS256',
  expiresIn: '1h', // 1 hour expiry as per requirements
  privateKey: process.env.JWT_PRIVATE_KEY,
  publicKey: process.env.JWT_PUBLIC_KEY,
  issuer: 'hotgigs-platform',
  audience: 'hotgigs-users',
  clockTolerance: 30, // 30 seconds clock tolerance
  maxAge: 3600, // 1 hour in seconds
} as const;

// Encryption Configuration
export const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 64,
  keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
  pbkdf2: {
    iterations: 100000,
    digest: 'sha512'
  }
} as const;

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  jobs: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // requests per window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  },
  applications: {
    windowMs: 60 * 60 * 1000,
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  },
  analytics: {
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
  }
} as const;

/**
 * Returns rate limit configuration based on route type with enhanced security controls
 * @param routeType - Type of route requiring rate limiting
 * @returns Rate limit configuration object
 */
export function getRateLimitConfig(routeType: keyof typeof RATE_LIMIT_CONFIG) {
  const baseConfig = RATE_LIMIT_CONFIG[routeType];
  
  return {
    ...baseConfig,
    handler: (req: any, res: any) => {
      res.status(429).json({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Too many requests, please try again later.',
          details: {
            retryAfter: res.getHeader('Retry-After'),
            limit: baseConfig.max,
            windowMs: baseConfig.windowMs
          }
        }
      });
    },
    keyGenerator: (req: any) => {
      // Combine IP and user ID for more accurate rate limiting
      return `${req.ip}-${req.user?.id || 'anonymous'}`;
    },
    skip: (req: any) => {
      // Skip rate limiting for whitelisted IPs or emergency access
      return req.headers['x-emergency-access'] === process.env.EMERGENCY_ACCESS_KEY;
    }
  };
}

/**
 * Returns encryption configuration for sensitive data with key rotation support
 * @returns Encryption configuration object
 */
export function getEncryptionConfig() {
  const key = process.env.ENCRYPTION_KEY!;
  
  return {
    ...ENCRYPTION_CONFIG,
    encrypt: (text: string): { encrypted: string; iv: string; tag: string } => {
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.algorithm,
        Buffer.from(key, 'hex'),
        iv
      ) as crypto.CipherGCM;
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    },
    decrypt: (encrypted: string, iv: string, tag: string): string => {
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        Buffer.from(key, 'hex'),
        Buffer.from(iv, 'hex')
      ) as crypto.DecipherGCM;
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    },
    deriveKey: (password: string, salt: string): Buffer => {
      return crypto.pbkdf2Sync(
        password,
        salt,
        ENCRYPTION_CONFIG.pbkdf2.iterations,
        ENCRYPTION_CONFIG.keyLength,
        ENCRYPTION_CONFIG.pbkdf2.digest
      );
    }
  };
}

// Security headers configuration
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
} as const;

// CORS Configuration
export const CORS_CONFIG = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://hotgigs.com', 'https://api.hotgigs.com']
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
} as const;