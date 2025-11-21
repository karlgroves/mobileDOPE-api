import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractBearerToken } from '../utils/jwt';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import User from '../models/User';

/**
 * Authentication Middleware
 *
 * JWT-based authentication and authorization middleware.
 */

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: number;
    }
  }
}

/**
 * Authenticate user with JWT
 * Requires valid access token in Authorization header
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return sendUnauthorized(res, 'Access token required');
    }

    // Verify token
    const payload = verifyAccessToken(token);

    // Find user
    const user = await User.findByPk(payload.userId);

    if (!user) {
      return sendUnauthorized(res, 'User not found');
    }

    // Check if user is active
    if (!user.is_active) {
      return sendForbidden(res, 'Account is inactive');
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendUnauthorized(res, error.message);
    }
    return sendUnauthorized(res, 'Authentication failed');
  }
}

/**
 * Optional authentication
 * Authenticates user if token is present, but doesn't fail if missing
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (token) {
      const payload = verifyAccessToken(token);
      const user = await User.findByPk(payload.userId);

      if (user && user.is_active) {
        req.user = user;
        req.userId = user.id;
      }
    }

    next();
  } catch {
    // Silently fail for optional authentication
    next();
  }
}

/**
 * Require verified email
 * Must be used after authenticate middleware
 */
export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendUnauthorized(res, 'Authentication required');
  }

  if (!req.user.is_verified) {
    return sendForbidden(res, 'Email verification required');
  }

  next();
}

/**
 * Check resource ownership
 * Ensures user owns the requested resource
 */
export function requireOwnership(resourceUserIdField: string = 'user_id') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendUnauthorized(res, 'Authentication required');
    }

    // Get resource user ID from request params, body, or query
    const resourceUserId =
      req.params[resourceUserIdField] ||
      req.body[resourceUserIdField] ||
      req.query[resourceUserIdField];

    if (!resourceUserId) {
      return next(); // Let the controller handle the missing ID
    }

    // Check ownership
    if (parseInt(resourceUserId, 10) !== req.user.id) {
      return sendForbidden(res, 'You do not have permission to access this resource');
    }

    next();
  };
}

/**
 * Rate limit by user
 * Tracks requests per user
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  const userRequests = new Map<number, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const now = Date.now();
    const userLimit = userRequests.get(req.userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset counter
      userRequests.set(req.userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000),
      });
    }

    // Increment counter
    userLimit.count++;
    next();
  };
}

/**
 * Middleware to ensure user owns the resource being accessed
 * Checks user_id in the resource fetched from database
 */
export function checkResourceOwnership(getResource: (req: Request) => Promise<any>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return sendUnauthorized(res, 'Authentication required');
      }

      const resource = await getResource(req);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
        });
      }

      if (resource.user_id !== req.user.id) {
        return sendForbidden(res, 'You do not have permission to access this resource');
      }

      // Attach resource to request for use in controller
      (req as any).resource = resource;

      next();
    } catch (error) {
      next(error);
    }
  };
}
