import { type Response } from 'express';

/**
 * Response Utilities
 *
 * Standard API response formatting for consistency across all endpoints.
 */

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

interface ErrorResponse {
  success: boolean;
  message: string;
  timestamp: string;
  errors?: unknown[];
  statusCode?: number;
}

/**
 * Send success response
 */
export function sendSuccess(
  res: Response,
  data?: unknown,
  message?: string,
  statusCode = 200,
): Response {
  const response: ApiResponse = {
    success: true,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    response.message = message;
  }

  if (data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send created response (201)
 */
export function sendCreated(res: Response, data?: unknown, message?: string): Response {
  return sendSuccess(res, data, message || 'Resource created successfully', 201);
}

/**
 * Send no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send paginated response
 */
export function sendPaginated(
  res: Response,
  data: unknown[],
  page: number,
  limit: number,
  total: number,
  message?: string,
): Response {
  const response: ApiResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  if (message) {
    response.message = message;
  }

  return res.status(200).json(response);
}

/**
 * Send error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown[],
): Response {
  const response: ErrorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors && errors.length > 0) {
    response.errors = errors;
  }

  // Include error details in development
  if (process.env.NODE_ENV === 'development') {
    response.statusCode = statusCode;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send validation error response
 */
export function sendValidationError(res: Response, errors: unknown[]): Response {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send unauthorized response
 */
export function sendUnauthorized(res: Response, message?: string): Response {
  return sendError(res, message || 'Authentication required', 401);
}

/**
 * Send forbidden response
 */
export function sendForbidden(res: Response, message?: string): Response {
  return sendError(res, message || 'Insufficient permissions', 403);
}

/**
 * Send not found response
 */
export function sendNotFound(res: Response, resource?: string): Response {
  return sendError(res, resource ? `${resource} not found` : 'Resource not found', 404);
}

/**
 * Send conflict response
 */
export function sendConflict(res: Response, message?: string): Response {
  return sendError(res, message || 'Resource already exists', 409);
}

/**
 * Send rate limit response
 */
export function sendRateLimit(res: Response): Response {
  return sendError(res, 'Too many requests. Please try again later.', 429);
}
