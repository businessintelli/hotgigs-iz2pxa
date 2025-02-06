import { z } from 'zod'; // ^3.22.0
import { BaseEntity } from '../types/common';

// Global rate limiting constants
const EMAIL_RATE_LIMIT = 100;
const EMAIL_BATCH_SIZE = 50;

// MJML Configuration schema
const MJMLConfigSchema = z.object({
  minify: z.boolean(),
  validationLevel: z.enum(['strict', 'soft', 'skip'])
});

// Email template schema
const EmailTemplateSchema = z.object({
  path: z.string(),
  subject: z.string(),
  mjmlConfig: MJMLConfigSchema
});

// SMTP configuration schema with pool settings
const SMTPConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  secure: z.boolean(),
  auth: z.object({
    user: z.string(),
    pass: z.string()
  }),
  pool: z.object({
    maxConnections: z.number().int().positive(),
    maxMessages: z.number().int().positive(),
    rateDelta: z.number().int().positive(),
    rateLimit: z.number().int().positive()
  })
});

// Rate limits schema
const RateLimitsSchema = z.object({
  perMinute: z.number().int().positive(),
  perHour: z.number().int().positive()
});

// Delivery configuration schema
const DeliveryConfigSchema = z.object({
  retryAttempts: z.number().int().positive(),
  retryDelay: z.number().int().positive(),
  timeout: z.number().int().positive(),
  rateLimits: RateLimitsSchema,
  batchSize: z.number().int().positive(),
  trackDelivery: z.boolean()
});

// Complete email configuration schema
export const EmailConfigSchema = z.object({
  smtp: SMTPConfigSchema,
  sender: z.object({
    name: z.string(),
    email: z.string().email(),
    replyTo: z.string().email()
  }),
  templates: z.object({
    interview: EmailTemplateSchema,
    reminder: EmailTemplateSchema,
    statusUpdate: EmailTemplateSchema
  }),
  delivery: DeliveryConfigSchema
});

// Main email configuration object
export const emailConfig = {
  smtp: {
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: true,
    auth: {
      user: 'api',
      pass: process.env.SENDGRID_API_KEY
    },
    pool: {
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 50
    }
  },
  sender: {
    name: 'HotGigs Recruitment',
    email: 'notifications@hotgigs.io',
    replyTo: 'support@hotgigs.io'
  },
  templates: {
    interview: {
      path: '/templates/email/interview',
      subject: 'Interview Scheduled: {{position}} at {{company}}',
      mjmlConfig: {
        minify: true,
        validationLevel: 'strict'
      }
    },
    reminder: {
      path: '/templates/email/reminder',
      subject: 'Reminder: {{eventType}} in {{timeUntil}}',
      mjmlConfig: {
        minify: true,
        validationLevel: 'strict'
      }
    },
    statusUpdate: {
      path: '/templates/email/status',
      subject: 'Application Status Update: {{status}}',
      mjmlConfig: {
        minify: true,
        validationLevel: 'strict'
      }
    }
  },
  delivery: {
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    rateLimits: {
      perMinute: EMAIL_RATE_LIMIT,
      perHour: 2000
    },
    batchSize: EMAIL_BATCH_SIZE,
    trackDelivery: true
  }
} as const;

/**
 * Validates the email configuration using the defined schema
 * @param emailConfig - The email configuration object to validate
 * @returns boolean indicating if the configuration is valid
 * @throws {z.ZodError} Detailed validation errors if configuration is invalid
 */
export function validateEmailConfig(config: typeof emailConfig): boolean {
  try {
    EmailConfigSchema.parse(config);
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Email configuration validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Type definition for the email configuration
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

// Validate configuration on module load
validateEmailConfig(emailConfig);