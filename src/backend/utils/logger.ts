import pino from 'pino'; // ^8.15.0
import { DatadogTracer } from 'dd-trace'; // ^4.0.0
import { ErrorCode } from '../types/common';

// Environment variables with defaults
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV;
const DD_API_KEY = process.env.DD_API_KEY;
const DD_ENV = process.env.NODE_ENV;

// Sensitive data patterns to mask
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /credit_card/i,
  /ssn/i
];

interface LoggerConfig {
  name?: string;
  level?: string;
  enableDatadog?: boolean;
  sampleRate?: number;
}

interface LogContext {
  [key: string]: any;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
}

class Logger {
  private logger: pino.Logger;
  private defaultContext: Record<string, any>;
  private tracer: DatadogTracer | null;
  private metrics: Record<string, number>;

  constructor(config: LoggerConfig = {}) {
    // Configure base logger options
    const loggerOptions: pino.LoggerOptions = {
      name: config.name || 'hotgigs-service',
      level: config.level || LOG_LEVEL,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      },
      redact: {
        paths: ['req.headers.authorization', '*.password', '*.token'],
        remove: true
      }
    };

    // Add pretty printing in development
    if (NODE_ENV === 'development') {
      loggerOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard'
        }
      };
    }

    this.logger = pino(loggerOptions);
    this.defaultContext = {
      service: config.name || 'hotgigs-service',
      environment: NODE_ENV,
      version: process.env.npm_package_version
    };

    // Initialize metrics
    this.metrics = {
      totalLogs: 0,
      errorCount: 0,
      warningCount: 0
    };

    // Set up Datadog tracer in production
    this.tracer = null;
    if (config.enableDatadog && DD_API_KEY && NODE_ENV === 'production') {
      this.tracer = new DatadogTracer({
        service: config.name,
        env: DD_ENV,
        logInjection: true,
        analytics: true
      });
    }
  }

  private sanitizeLogData(data: any): any {
    if (!data) return data;

    if (typeof data === 'object') {
      const sanitized = { ...data };
      for (const key in sanitized) {
        if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeLogData(sanitized[key]);
        }
      }
      return sanitized;
    }

    return data;
  }

  private enrichLogContext(context: LogContext = {}): LogContext {
    const enrichedContext = {
      ...this.defaultContext,
      ...context,
      timestamp: new Date().toISOString()
    };

    if (this.tracer) {
      const span = this.tracer.scope().active();
      if (span) {
        enrichedContext.traceId = span.context().toTraceId();
        enrichedContext.spanId = span.context().toSpanId();
      }
    }

    return this.sanitizeLogData(enrichedContext);
  }

  info(message: string, context: LogContext = {}): void {
    this.metrics.totalLogs++;
    this.logger.info(this.enrichLogContext(context), message);
  }

  error(error: Error | string, context: LogContext = {}): void {
    this.metrics.totalLogs++;
    this.metrics.errorCount++;

    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code || ErrorCode.INTERNAL_ERROR
      } : { message: error }
    };

    this.logger.error(this.enrichLogContext(errorContext), error instanceof Error ? error.message : error);

    // Alert on high error rates
    if (this.metrics.errorCount > 100 && NODE_ENV === 'production') {
      // Trigger alert through configured channels
      this.logger.fatal('High error rate detected');
    }
  }

  warn(message: string, context: LogContext = {}): void {
    this.metrics.totalLogs++;
    this.metrics.warningCount++;
    this.logger.warn(this.enrichLogContext(context), message);
  }

  debug(message: string, context: LogContext = {}): void {
    if (this.logger.level === 'debug') {
      this.metrics.totalLogs++;
      this.logger.debug(this.enrichLogContext(context), message);
    }
  }

  getMetrics(): Record<string, number> {
    return { ...this.metrics };
  }
}

// Create default logger instance
const logger = new Logger({
  name: 'hotgigs-service',
  enableDatadog: NODE_ENV === 'production',
  sampleRate: 1.0
});

export { Logger, logger };