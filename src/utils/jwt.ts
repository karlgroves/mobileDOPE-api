import jwt from 'jsonwebtoken';
import { AuthenticationError } from './errors';

/**
 * JWT Utilities
 *
 * Token generation, verification, and refresh token management
 * for JWT-based authentication.
 */

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_changeme_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Access token: 15 minutes
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Refresh token: 7 days

export interface JwtPayload {
  userId: number;
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Generate access token
 */
export function generateAccessToken(userId: number, email: string): string {
  const payload: JwtPayload = {
    userId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'mobile-dope-api',
    audience: 'mobile-dope-app',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: number, email: string): string {
  const payload: JwtPayload = {
    userId,
    email,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'mobile-dope-api',
    audience: 'mobile-dope-app',
  });
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(userId: number, email: string) {
  return {
    accessToken: generateAccessToken(userId, email),
    refreshToken: generateRefreshToken(userId, email),
    expiresIn: JWT_EXPIRES_IN,
  };
}

/**
 * Verify and decode token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'mobile-dope-api',
      audience: 'mobile-dope-app',
    }) as JwtPayload;

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
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
  const payload = verifyToken(token);

  if (payload.type !== 'access') {
    throw new AuthenticationError('Invalid token type');
  }

  return payload;
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  const payload = verifyToken(token);

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

  return parts[1];
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    if (!decoded || !decoded.exp) {
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
