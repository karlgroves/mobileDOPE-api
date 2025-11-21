/**
 * Jest Test Setup
 *
 * Global test configuration and utilities.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.DB_NAME = 'mobile_dope_test';
process.env.LOG_LEVEL = 'error';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console output in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
