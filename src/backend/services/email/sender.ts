import nodemailer from 'nodemailer'; // ^6.9.4
import rateLimit from 'express-rate-limit'; // ^6.9.0
import { emailConfig } from '../../config/email';
import { InterviewEmailTemplate } from './templates/interview';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/error-handler';

/**
 * Interface for email sending options
 */
interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  priority?: 'high' | 'normal' | 'low';
  calendarEvent?: string;
}

/**
 * Interface for email delivery metrics
 */
interface EmailMetrics {
  totalSent: number;
  failed: number;
  bounced: number;
  avgDeliveryTime: number;
  rateLimit: {
    current: number;
    limit: number;
    resetTime: Date;
  };
}

/**
 * Enterprise-grade email sending service with comprehensive delivery management
 */
export class EmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly rateLimiter: ReturnType<typeof rateLimit>;
  private readonly queue: Map<string, EmailOptions>;
  private readonly metrics: EmailMetrics;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor() {
    // Initialize SMTP transporter with connection pooling
    this.transporter = nodemailer.createTransport({
      ...emailConfig.smtp,
      pool: true,
      maxConnections: emailConfig.smtp.pool.maxConnections,
      maxMessages: emailConfig.smtp.pool.maxMessages,
      rateDelta: emailConfig.smtp.pool.rateDelta,
      rateLimit: emailConfig.smtp.pool.rateLimit
    });

    // Configure rate limiting
    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: emailConfig.delivery.rateLimits.perMinute,
      message: 'Too many email requests'
    });

    // Initialize email queue and metrics
    this.queue = new Map();
    this.metrics = {
      totalSent: 0,
      failed: 0,
      bounced: 0,
      avgDeliveryTime: 0,
      rateLimit: {
        current: 0,
        limit: emailConfig.delivery.rateLimits.perMinute,
        resetTime: new Date()
      }
    };

    this.maxRetries = emailConfig.delivery.retryAttempts;
    this.retryDelay = emailConfig.delivery.retryDelay;

    // Verify SMTP connection
    this.verifyConnection();
  }

  /**
   * Sends an email with comprehensive retry logic and monitoring
   */
  public async sendEmail(options: EmailOptions): Promise<boolean> {
    const correlationId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate email options
      this.validateEmailOptions(options);

      // Check rate limits
      if (this.isRateLimited()) {
        this.queue.set(correlationId, options);
        logger.info('Email queued due to rate limiting', { correlationId });
        return true;
      }

      const startTime = Date.now();

      // Prepare email with default sender
      const mailOptions = {
        from: `${emailConfig.sender.name} <${emailConfig.sender.email}>`,
        replyTo: emailConfig.sender.replyTo,
        ...options
      };

      // Attempt delivery with retries
      const result = await this.attemptDelivery(mailOptions, 0);

      // Update metrics
      this.updateMetrics(startTime, result);

      logger.info('Email sent successfully', {
        correlationId,
        recipient: options.to,
        deliveryTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('Email sending failed', {
        correlationId,
        error,
        recipient: options.to
      });

      this.metrics.failed++;

      throw new AppError(
        'Failed to send email',
        'EMAIL_DELIVERY_FAILED',
        { correlationId, recipient: options.to }
      );
    }
  }

  /**
   * Sends multiple emails in optimized batches
   */
  public async sendBulkEmails(emailOptionsList: EmailOptions[]): Promise<Array<{ success: boolean; error?: Error; metadata: object }>> {
    const results: Array<{ success: boolean; error?: Error; metadata: object }> = [];
    const batchSize = emailConfig.delivery.batchSize;

    // Process emails in batches
    for (let i = 0; i < emailOptionsList.length; i += batchSize) {
      const batch = emailOptionsList.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(options => this.sendEmail(options))
      );

      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({
            success: result.value,
            metadata: {
              index: i + index,
              timestamp: new Date().toISOString()
            }
          });
        } else {
          results.push({
            success: false,
            error: result.reason,
            metadata: {
              index: i + index,
              timestamp: new Date().toISOString()
            }
          });
        }
      });

      // Implement progressive delay between batches
      if (i + batchSize < emailOptionsList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Gets current email delivery metrics
   */
  public getMetrics(): EmailMetrics {
    return { ...this.metrics };
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
    } catch (error) {
      logger.error('SMTP connection verification failed', { error });
      throw new AppError('Failed to verify SMTP connection', 'SMTP_VERIFICATION_FAILED');
    }
  }

  private async attemptDelivery(
    mailOptions: nodemailer.SendMailOptions,
    attemptCount: number
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      if (attemptCount < this.maxRetries) {
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attemptCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.attemptDelivery(mailOptions, attemptCount + 1);
      }
      throw error;
    }
  }

  private validateEmailOptions(options: EmailOptions): void {
    if (!options.to || (!options.html && !options.text)) {
      throw new AppError(
        'Invalid email options',
        'INVALID_EMAIL_OPTIONS',
        { options }
      );
    }
  }

  private isRateLimited(): boolean {
    const currentRate = this.metrics.rateLimit.current;
    const rateLimit = this.metrics.rateLimit.limit;
    
    if (currentRate >= rateLimit) {
      const now = new Date();
      if (now > this.metrics.rateLimit.resetTime) {
        // Reset rate limit counter
        this.metrics.rateLimit.current = 0;
        this.metrics.rateLimit.resetTime = new Date(now.getTime() + 60000);
        return false;
      }
      return true;
    }
    
    this.metrics.rateLimit.current++;
    return false;
  }

  private updateMetrics(startTime: number, success: boolean): void {
    const deliveryTime = Date.now() - startTime;
    
    this.metrics.totalSent++;
    this.metrics.avgDeliveryTime = (
      (this.metrics.avgDeliveryTime * (this.metrics.totalSent - 1) + deliveryTime) /
      this.metrics.totalSent
    );
    
    if (!success) {
      this.metrics.failed++;
    }
  }
}