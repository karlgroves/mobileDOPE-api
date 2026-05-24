import 'express';
import type User from '../models/User';

/**
 * Express type augmentation.
 *
 * Adds the request-scoped properties that our authentication and
 * validation middleware attach to `req`, so controllers can read them
 * type-safely without casting through `any`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- module augmentation requires the Express namespace
  namespace Express {
    interface Request {
      /** Authenticated user (set by `authenticate`). */
      user?: User;
      /** Authenticated user id (set by `authenticate`). */
      userId?: number;
      /** Pagination params (set by `validatePagination`). */
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
      /** Parsed numeric `:id` route param (set by `validateId`). */
      idParsed?: number;
      /** Resource loaded by `checkResourceOwnership`. */
      resource?: unknown;
    }
  }
}
