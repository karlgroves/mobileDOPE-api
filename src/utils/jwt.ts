import jwt from 'jsonwebtoken';

import { AuthenticationError } from './errors';

/**
 * JWT Utilities
 *
 * Token generation, verification, and refresh token management
 * for JWT-based authentication.
 *
 * Uses separate secrets for access and refresh tokens to limit
 * the blast radius of a compromised token.
 */

function getJwtSecret(type: 'access' | 'refresh'): string {
  const isProduction = process.env.NODE_ENV === 'production';

  if (type === 'refresh') {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      if (isProduction) {
        throw new Error('JWT_REFRESH_SECRET must be set in production');
      }
      return 'dev_refresh_secret_DO_NOT_USE_IN_PRODUCTION';
    }
    return secret;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev_jwt_secret_DO_NOT_USE_IN_PRODUCTION';
  }
  return secret;
}

export interface JwtPayload {
  userId: number;
  email: string;
  type: 'access' | 'refresh';
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

/**
 * Generate access token
 */
export function generateAccessToken(userId: number, email: string, tokenVersion = 0): string {
  const payload: JwtPayload = {
    userId,
    email,
    type: 'access',
    tokenVersion,
  };

  return jwt.sign(payload, getJwtSecret('access'), {
    expiresIn: 900, // 15 minutes in seconds
    issuer: 'mobile-dope-api',
    audience: 'mobile-dope-app',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: number, email: string, tokenVersion = 0): string {
  const payload: JwtPayload = {
    userId,
    email,
    type: 'refresh',
    tokenVersion,
  };

  return jwt.sign(payload, getJwtSecret('refresh'), {
    expiresIn: 604800, // 7 days in seconds
    issuer: 'mobile-dope-api',
    audience: 'mobile-dope-app',
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(userId: number, email: string, tokenVersion = 0) {
  return {
    accessToken: generateAccessToken(userId, email, tokenVersion),
    refreshToken: generateRefreshToken(userId, email, tokenVersion),
    expiresIn: '15m',
  };
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string, type: 'access' | 'refresh' = 'access'): JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(type), {
      issuer: 'mobile-dope-api',
      audience: 'mobile-dope-app',
    }) as JwtPayload;

    return decoded;
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    } else {
      throw new AuthenticationError('Token verification failed');
    }
  }
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JwtPayload {
  const payload = verifyToken(token, 'access');

  if (payload.type !== 'access') {
    throw new AuthenticationError('Invalid token type');
  }

  return payload;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  const payload = verifyToken(token, 'refresh');

  if (payload.type !== 'refresh') {
    throw new AuthenticationError('Invalid refresh token');
  }

  return payload;
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    if (!decoded?.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) {
    return true;
  }
  return expiration < new Date();
}
