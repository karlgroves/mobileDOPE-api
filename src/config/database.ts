import { Sequelize, Options } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Database Configuration
 *
 * Configures Sequelize connection to MySQL 9.x database with optimized settings.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Database connection parameters
const dbConfig: Options = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'mobile_dope_dev',
  username: process.env.DB_USER || 'api_user',
  password: process.env.DB_PASSWORD || 'dev_password_changeme',
  dialect: 'mysql',

  // MySQL 9.x optimizations
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_0900_ai_ci',
    connectTimeout: 10000,
    // Enable multiple statements for migrations
    multipleStatements: true,
    // SSL configuration for production (Digital Ocean requires SSL)
    ...(isProduction && {
      ssl: {
        require: true,
        rejectUnauthorized: true,
      },
    }),
  },

  // Connection pool settings
  pool: {
    max: isProduction ? 10 : 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },

  // Logging configuration
  logging: isTest ? false : (sql: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[Sequelize]', sql);
    }
  },

  // Timezone configuration (store all dates as UTC)
  timezone: '+00:00',

  // Performance optimizations
  define: {
    // Use snake_case for auto-generated columns
    underscored: true,
    // Disable timestamp fields by default (we define them explicitly)
    timestamps: true,
    // Disable createdAt/updatedAt field names (using created_at/updated_at)
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    // Paranoid mode for soft deletes (optional)
    paranoid: false,
    // Freeze table names (don't pluralize)
    freezeTableName: true,
    // Model name same as table name
    tableName: undefined,
  },

  // Benchmark queries in development
  benchmark: !isProduction,

  // Retry configuration
  retry: {
    max: 3,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/,
    ],
  },
};

// Create Sequelize instance
const sequelize = new Sequelize(dbConfig);

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');

    // Log MySQL version in development
    if (!isProduction) {
      const [results] = await sequelize.query('SELECT VERSION() as version');
      const version = (results as any)[0]?.version;
      console.log(`✓ MySQL version: ${version}`);
    }

    return true;
  } catch (error) {
    console.error('✗ Unable to connect to database:', error);
    return false;
  }
}

/**
 * Close database connection gracefully
 */
export async function closeConnection(): Promise<void> {
  try {
    await sequelize.close();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('✗ Error closing database connection:', error);
  }
}

/**
 * Sync all models with database (development only)
 * WARNING: This will drop tables if force is true
 */
export async function syncDatabase(force = false): Promise<void> {
  if (isProduction && force) {
    throw new Error('Cannot force sync database in production');
  }

  try {
    await sequelize.sync({ force, alter: !force && !isProduction });
    console.log(`✓ Database synced ${force ? '(forced)' : '(altered)'}`);
  } catch (error) {
    console.error('✗ Error syncing database:', error);
    throw error;
  }
}

export default sequelize;
