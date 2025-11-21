# Middlewares

This directory contains Express middleware functions.

## Planned Middlewares

- `auth.ts` - JWT authentication middleware
- `validation.ts` - Request validation middleware (using express-validator)
- `errorHandler.ts` - Global error handling middleware
- `rateLimit.ts` - Rate limiting configuration
- `logger.ts` - Request logging middleware
- `cors.ts` - CORS configuration middleware

All middlewares should follow Express middleware signature: `(req, res, next) => void`
