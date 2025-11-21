/**
 * Mobile DOPE API Server
 * Entry point for the Express application
 *
 * @author Mobile DOPE Development Team
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection, closeConnection } from './config/database';
import routes from './routes';
import { errorHandler, notFoundHandler, handleUncaughtErrors } from './middlewares/errorHandler';
import { sanitizeInput } from './middlewares/validation';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

// Handle uncaught errors
handleUncaughtErrors();

const app: Application = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
  });
});

// API base endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Mobile DOPE API',
    version: '1.0.0',
    documentation: '/api-docs',
    health: '/health',
    api: '/api',
  });
});

// API routes
app.use('/api', routes);

// 404 handler (must come after all routes)
app.use(notFoundHandler);

// Global error handler (must come last)
app.use(errorHandler);

// Initialize server
let server: any;

async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.fatal('Failed to connect to database. Server not started.');
      process.exit(1);
    }

    // Start HTTP server
    server = app.listen(PORT, () => {
      logger.info(`Mobile DOPE API running on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API endpoints: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} signal received: closing server gracefully`);

  // Close HTTP server first
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connection
      await closeConnection();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });
  } else {
    await closeConnection();
    process.exit(0);
  }

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
