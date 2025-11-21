import { Router } from 'express';
import authRoutes from './auth.routes';

/**
 * Routes Index
 *
 * Central router that aggregates all API routes.
 */

const router = Router();

// API version 1 routes
router.use('/v1/auth', authRoutes);

// Health check for API routes
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    api: 'v1',
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'Mobile DOPE API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      rifles: '/api/v1/rifles (coming soon)',
      ammo: '/api/v1/ammo (coming soon)',
      dope: '/api/v1/dope (coming soon)',
      environment: '/api/v1/environment (coming soon)',
    },
    documentation: '/api-docs (coming soon)',
  });
});

export default router;
