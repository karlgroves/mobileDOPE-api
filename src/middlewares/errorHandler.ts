import { Request, Response, NextFunction } from 'express';
import { AppError, formatErrorResponse, isOperationalError } from '../utils/errors';
import logger, { logError } from '../utils/logger';

/**
 * Error Handler Middleware
 *
 * Global error handling for all routes with proper logging
 * and response formatting.
 */

/**
 * Global error handler
 * Should be registered last in middleware chain
 */
export function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction) {
  // Log error
  logError(err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: (req as any).userId,
  });

  // Handle operational errors
  if (err instanceof AppError) {
    const response = formatErrorResponse(err);
    return res.status(err.statusCode).json(response);
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid data provided',
      errors: (err as any).errors?.map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Handle Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Conflict',
      message: 'Resource already exists',
      errors: (err as any).errors?.map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Handle Sequelize foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Invalid reference to related resource',
    });
  }

  // Handle Sequelize database errors
  if (err.name === 'SequelizeDatabaseError') {
    logger.error({ err }, 'Database error occurred');
    return res.status(500).json({
      success: false,
      error: 'Database Error',
      message: 'A database error occurred',
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication Error',
      message: err.message,
    });
  }

  // Handle unexpected errors
  logger.error({ err }, 'Unexpected error occurred');

  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors and pass to error handler
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 * Should be registered before error handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
}

/**
 * Handle process errors
 */
export function handleUncaughtErrors() {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');

    if (!isOperationalError(error)) {
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.fatal({ reason }, 'Unhandled Promise Rejection');

    if (reason instanceof Error && !isOperationalError(reason)) {
      process.exit(1);
    }
  });
}
