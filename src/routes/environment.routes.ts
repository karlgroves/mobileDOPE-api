import { Router } from 'express';
import { body, query } from 'express-validator';
import EnvironmentSnapshotController from '../controllers/EnvironmentSnapshotController';
import { validate, validatePagination, validateId } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

/**
 * Environment Snapshot Routes
 *
 * Defines all environmental condition snapshot endpoints with validation.
 */

const router = Router();

// All environment routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/environment/current
 * @desc    Get most recent environment snapshot
 * @access  Private
 */
router.get(
  '/current',
  asyncHandler(EnvironmentSnapshotController.getCurrent.bind(EnvironmentSnapshotController))
);

/**
 * @route   GET /api/v1/environment/averages
 * @desc    Get average conditions for date range
 * @access  Private
 */
router.get(
  '/averages',
  validate([
    query('date_from')
      .notEmpty()
      .isISO8601()
      .withMessage('Valid date_from is required (ISO 8601)'),
    query('date_to')
      .notEmpty()
      .isISO8601()
      .withMessage('Valid date_to is required (ISO 8601)'),
  ]),
  asyncHandler(EnvironmentSnapshotController.getAverages.bind(EnvironmentSnapshotController))
);

/**
 * @route   GET /api/v1/environment
 * @desc    Get all environment snapshots for authenticated user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validate([
    query('temp_min').optional().isFloat({ min: -50, max: 150 }),
    query('temp_max').optional().isFloat({ min: -50, max: 150 }),
    query('date_from').optional().isISO8601(),
    query('date_to').optional().isISO8601(),
  ]),
  asyncHandler(EnvironmentSnapshotController.getAll.bind(EnvironmentSnapshotController))
);

/**
 * @route   GET /api/v1/environment/:id
 * @desc    Get single environment snapshot
 * @access  Private
 */
router.get(
  '/:id',
  validateId('id'),
  asyncHandler(EnvironmentSnapshotController.getById.bind(EnvironmentSnapshotController))
);

/**
 * @route   POST /api/v1/environment
 * @desc    Create new environment snapshot
 * @access  Private
 */
router.post(
  '/',
  validate([
    body('temperature')
      .isFloat({ min: -50, max: 150 })
      .withMessage('Temperature must be between -50 and 150 °F'),
    body('humidity')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Humidity must be between 0 and 100%'),
    body('pressure')
      .isFloat({ min: 20, max: 35 })
      .withMessage('Pressure must be between 20 and 35 inHg'),
    body('altitude')
      .isFloat({ min: -1000, max: 30000 })
      .withMessage('Altitude must be between -1000 and 30000 feet'),
    body('wind_speed')
      .isFloat({ min: 0, max: 100 })
      .withMessage('Wind speed must be between 0 and 100 mph'),
    body('wind_direction')
      .isFloat({ min: 0, max: 359.99 })
      .withMessage('Wind direction must be between 0 and 360 degrees'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    body('density_altitude')
      .optional()
      .isFloat()
      .withMessage('Density altitude must be a number'),
  ]),
  asyncHandler(EnvironmentSnapshotController.create.bind(EnvironmentSnapshotController))
);

/**
 * @route   PUT /api/v1/environment/:id
 * @desc    Update environment snapshot
 * @access  Private
 */
router.put(
  '/:id',
  validateId('id'),
  validate([
    body('temperature')
      .optional()
      .isFloat({ min: -50, max: 150 }),
    body('humidity')
      .optional()
      .isFloat({ min: 0, max: 100 }),
    body('pressure')
      .optional()
      .isFloat({ min: 20, max: 35 }),
    body('altitude')
      .optional()
      .isFloat({ min: -1000, max: 30000 }),
    body('wind_speed')
      .optional()
      .isFloat({ min: 0, max: 100 }),
    body('wind_direction')
      .optional()
      .isFloat({ min: 0, max: 359.99 }),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }),
    body('density_altitude')
      .optional()
      .isFloat(),
  ]),
  asyncHandler(EnvironmentSnapshotController.update.bind(EnvironmentSnapshotController))
);

/**
 * @route   DELETE /api/v1/environment/:id
 * @desc    Delete environment snapshot
 * @access  Private
 */
router.delete(
  '/:id',
  validateId('id'),
  asyncHandler(EnvironmentSnapshotController.delete.bind(EnvironmentSnapshotController))
);

export default router;
