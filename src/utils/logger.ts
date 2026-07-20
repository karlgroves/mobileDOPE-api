import bunyan from 'bunyan';
import { type Request, type Response } from 'express';

/**
 * Logger Utility
 *
 * Structured logging using Bunyan for consistent log formatting
 * and multiple output streams.
 */

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as bunyan.LogLevel;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Error logs to a separate stream in production
const productionStreams: bunyan.Stream[] =
  NODE_ENV === 'production' ? [{ stream: process.stderr, level: 'error' }] : [];

// Create base logger
const logger = bunyan.createLogger({
  name: 'mobile-dope-api',
  level: LOG_LEVEL,
  streams: [
    {
      // Standard output in development
      stream: process.stdout,
      level: NODE_ENV === 'development' ? 'debug' : 'info',
    },
    ...productionStreams,
  ],
  serializers: bunyan.stdSerializers,
});

/**
 * Create child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log HTTP request
 */
export function logRequest(req: Request) {
  logger.info(
    {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    'HTTP Request',
  );
}

/**
 * Log HTTP response
 */
export function logResponse(req: Request, res: Response, duration: number) {
  logger.info(
    {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
    },
    'HTTP Response',
  );
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(
    {
      err: error,
      ...context,
    },
    error.message,
  );
}

/**
 * Log authentication event
 */
export function logAuth(event: string, userId?: number, details?: Record<string, unknown>) {
  logger.info(
    {
      event,
      userId,
      ...details,
    },
    `Auth: ${event}`,
  );
}

/**
 * Log database operation
 */
export function logDatabase(operation: string, table: string, duration?: number) {
  logger.debug(
    {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
    },
    `Database: ${operation} on ${table}`,
  );
}

export default logger;
