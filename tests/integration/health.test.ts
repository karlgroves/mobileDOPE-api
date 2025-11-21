/**
 * Health Check Integration Tests
 *
 * Tests for API health check endpoints.
 */

import request from 'supertest';
import app from '../../src/server';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment', 'test');
    });
  });

  describe('GET /api/health', () => {
    it('should return API health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('api', 'v1');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api', () => {
    it('should return API info', async () => {
      const response = await request(app).get('/api');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('name', 'Mobile DOPE API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('auth', '/api/v1/auth');
      expect(response.body.endpoints).toHaveProperty('rifles', '/api/v1/rifles');
      expect(response.body.endpoints).toHaveProperty('ammo', '/api/v1/ammo');
      expect(response.body.endpoints).toHaveProperty('dope', '/api/v1/dope');
      expect(response.body.endpoints).toHaveProperty('environment', '/api/v1/environment');
    });
  });

  describe('GET /api/invalid-endpoint', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/invalid-endpoint');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });
});
