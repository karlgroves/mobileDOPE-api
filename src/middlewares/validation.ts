import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { sendValidationError } from '../utils/response';
import { asyncHandler } from './errorHandler';

/**
 * Validation Middleware
 *
 * Express-validator integration for request validation.
 */

/**
 * Validate request using express-validator chains
 */
export function validate(validations: ValidationChain[]) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    // Format errors (exclude submitted values to prevent leaking sensitive data)
    const formattedErrors = errors.array().map((error) => ({
      field: 'path' in error ? error.path : undefined,
      message: error.msg as string,
    }));

    return sendValidationError(res, formattedErrors);
  });
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  // Strip HTML tags and dangerous characters from string inputs
  const sanitizeValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      // Replace HTML entities and strip tags using iterative approach
      // to prevent bypass via nested tags like <scr<script>ipt>
      let sanitized = value;
      let prev;
      do {
        prev = sanitized;
        sanitized = sanitized.replace(/<[^>]*>/g, '');
      } while (sanitized !== prev);
      return sanitized;
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (typeof value === 'object' && value !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const key in value) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue; // Prevent prototype pollution
        }
        sanitized[key] = sanitizeValue((value as Record<string, unknown>)[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  if (req.query) {
    req.query = sanitizeValue(req.query) as typeof req.query;
  }

  if (req.params) {
    req.params = sanitizeValue(req.params) as typeof req.params;
  }

  next();
}

/**
 * Validate pagination parameters
 */
export function validatePagination(req: Request, res: Response, next: NextFunction) {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 10;

  // Validate page
  if (page < 1) {
    return sendValidationError(res, [
      {
        field: 'page',
        message: 'Page must be greater than 0',
        value: page,
      },
    ]);
  }

  // Validate limit
  if (limit < 1 || limit > 100) {
    return sendValidationError(res, [
      {
        field: 'limit',
        message: 'Limit must be between 1 and 100',
        value: limit,
      },
    ]);
  }

  // Attach to request
  req.pagination = {
    page,
    limit,
    offset: (page - 1) * limit,
  };

  return next();
}

/**
 * Validate ID parameter
 */
export function validateId(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params[paramName] ?? '', 10);

    if (isNaN(id) || id < 1) {
      return sendValidationError(res, [
        {
          field: paramName,
          message: 'Invalid ID',
          value: req.params[paramName],
        },
      ]);
    }

    // Attach parsed ID to request
    req.idParsed = id;

    return next();
  };
}
