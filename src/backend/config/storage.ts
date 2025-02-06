import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from '../types/common';

// Environment variables validation
const requiredEnvVars = {
  STORAGE_URL: process.env.SUPABASE_STORAGE_URL,
  STORAGE_KEY: process.env.SUPABASE_STORAGE_KEY,
  STORAGE_ENCRYPTION_KEY: process.env.STORAGE_ENCRYPTION_KEY,
} as const;

// Storage bucket configuration schema
const BucketConfigSchema = z.object({
  name: z.string(),
  path: z.string(),
  public: z.boolean(),
  retentionDays: z.number().int().positive(),
  maxFiles: z.number().int().positive(),
  encryption: z.boolean()
});

// File limits configuration schema
const FileLimitsSchema = z.object({
  maxFileSize: z.record(z.number().int().positive()),
  allowedTypes: z.record(z.array(z.string()))
});

// CDN configuration schema
const CdnConfigSchema = z.object({
  enabled: z.boolean(),
  domain: z.string().url(),
  cacheControl: z.string(),
  compressionLevel: z.enum(['low', 'medium', 'high']),
  errorLogging: z.boolean()
});

// Security configuration schema
const SecurityConfigSchema = z.object({
  signedUrlExpiry: z.number().int().positive(),
  maxSignedUrls: z.number().int().positive(),
  corsOrigins: z.array(z.string().url()),
  encryption: z.object({
    algorithm: z.enum(['AES-256-GCM']),
    keyRotationDays: z.number().int().positive()
  }),
  virusScanning: z.object({
    enabled: z.boolean(),
    quarantinePath: z.string(),
    maxFileSize: z.number().int().positive()
  }),
  auditLogging: z.object({
    enabled: z.boolean(),
    retentionDays: z.number().int().positive(),
    detailedEvents: z.boolean()
  })
});

// Complete storage configuration schema
export const StorageConfigSchema = z.object({
  buckets: z.record(BucketConfigSchema),
  limits: FileLimitsSchema,
  cdn: CdnConfigSchema,
  security: SecurityConfigSchema
});

// Storage configuration object
export const storageConfig = {
  buckets: {
    resumes: {
      name: 'resumes',
      path: 'resumes',
      public: false,
      retentionDays: 1825, // 5 years
      maxFiles: 1000000,
      encryption: true
    },
    profileImages: {
      name: 'profiles',
      path: 'images/profiles',
      public: true,
      retentionDays: 365,
      maxFiles: 1000000,
      encryption: false
    },
    documents: {
      name: 'documents',
      path: 'documents',
      public: false,
      retentionDays: 730,
      maxFiles: 1000000,
      encryption: true
    }
  },
  limits: {
    maxFileSize: {
      resumes: 10485760, // 10MB
      profileImages: 5242880, // 5MB
      documents: 15728640 // 15MB
    },
    allowedTypes: {
      resumes: ['.pdf', '.doc', '.docx', '.rtf', '.txt'],
      profileImages: ['.jpg', '.jpeg', '.png', '.gif'],
      documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx']
    }
  },
  cdn: {
    enabled: true,
    domain: 'storage.hotgigs.com',
    cacheControl: 'public, max-age=31536000',
    compressionLevel: 'high' as const,
    errorLogging: true
  },
  security: {
    signedUrlExpiry: 900, // 15 minutes
    maxSignedUrls: 100,
    corsOrigins: ['https://hotgigs.com'],
    encryption: {
      algorithm: 'AES-256-GCM' as const,
      keyRotationDays: 90
    },
    virusScanning: {
      enabled: true,
      quarantinePath: 'quarantine',
      maxFileSize: 52428800 // 50MB
    },
    auditLogging: {
      enabled: true,
      retentionDays: 90,
      detailedEvents: true
    }
  }
} as const;

// Validate storage configuration
export function validateStorageConfig(config: typeof storageConfig): boolean {
  try {
    StorageConfigSchema.parse(config);
    return true;
  } catch (error) {
    console.error('Storage configuration validation failed:', error);
    return false;
  }
}

// Generate signed URL for secure file access
export async function getSignedUrl(
  bucketName: keyof typeof storageConfig.buckets,
  filePath: string,
  expirySeconds: number = storageConfig.security.signedUrlExpiry
): Promise<string> {
  const bucket = storageConfig.buckets[bucketName];
  
  if (!bucket) {
    throw new Error(`Invalid bucket: ${bucketName}`);
  }

  if (bucket.public) {
    return `${storageConfig.cdn.domain}/${bucket.path}/${filePath}`;
  }

  // Validate expiry time
  const maxExpiry = storageConfig.security.signedUrlExpiry;
  const validExpiry = Math.min(expirySeconds, maxExpiry);

  // Generate signed URL using Supabase Storage API
  const url = new URL(`${requiredEnvVars.STORAGE_URL}/object/sign/${bucket.name}/${filePath}`);
  url.searchParams.append('token', requiredEnvVars.STORAGE_KEY);
  url.searchParams.append('expiresIn', validExpiry.toString());

  return url.toString();
}

// Type guard for bucket names
export function isBucketName(name: string): name is keyof typeof storageConfig.buckets {
  return name in storageConfig.buckets;
}

// Validate file type against allowed types
export function isAllowedFileType(
  bucketName: keyof typeof storageConfig.buckets,
  fileName: string
): boolean {
  const allowedTypes = storageConfig.limits.allowedTypes[bucketName];
  return allowedTypes.some(type => fileName.toLowerCase().endsWith(type));
}

// Validate file size against limits
export function isAllowedFileSize(
  bucketName: keyof typeof storageConfig.buckets,
  fileSize: number
): boolean {
  return fileSize <= storageConfig.limits.maxFileSize[bucketName];
}