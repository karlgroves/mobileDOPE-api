import { Router } from 'express';
import { body, query } from 'express-validator';
import RifleProfileController from '../controllers/RifleProfileController';
import { validate, validatePagination, validateId } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

/**
 * Rifle Profile Routes
 *
 * Defines all rifle profile endpoints with validation.
 */

const router = Router();

// All rifle routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/rifles
 * @desc    Get all rifle profiles for authenticated user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validate([
    query('caliber').optional().trim().isLength({ max: 100 }),
    query('search').optional().trim().isLength({ max: 255 }),
  ]),
  asyncHandler(RifleProfileController.getAll.bind(RifleProfileController))
);

/**
 * @route   GET /api/v1/rifles/:id
 * @desc    Get single rifle profile
 * @access  Private
 */
router.get(
  '/:id',
  validateId('id'),
  asyncHandler(RifleProfileController.getById.bind(RifleProfileController))
);

/**
 * @route   GET /api/v1/rifles/:id/stats
 * @desc    Get rifle statistics
 * @access  Private
 */
router.get(
  '/:id/stats',
  validateId('id'),
  asyncHandler(RifleProfileController.getStats.bind(RifleProfileController))
);

/**
 * @route   POST /api/v1/rifles
 * @desc    Create new rifle profile
 * @access  Private
 */
router.post(
  '/',
  validate([
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Rifle name is required')
      .isLength({ max: 255 })
      .withMessage('Name must not exceed 255 characters'),
    body('caliber')
      .trim()
      .notEmpty()
      .withMessage('Caliber is required')
      .isLength({ max: 100 })
      .withMessage('Caliber must not exceed 100 characters'),
    body('barrel_length')
      .isFloat({ min: 0.01, max: 50 })
      .withMessage('Barrel length must be between 0 and 50 inches'),
    body('twist_rate')
      .trim()
      .matches(/^1:\d+$/)
      .withMessage('Twist rate must be in format "1:X"'),
    body('zero_distance')
      .isFloat({ min: 0.01, max: 1000 })
      .withMessage('Zero distance must be between 0 and 1000 yards'),
    body('optic_manufacturer')
      .trim()
      .notEmpty()
      .withMessage('Optic manufacturer is required')
      .isLength({ max: 255 }),
    body('optic_model')
      .trim()
      .notEmpty()
      .withMessage('Optic model is required')
      .isLength({ max: 255 }),
    body('reticle_type')
      .trim()
      .notEmpty()
      .withMessage('Reticle type is required')
      .isLength({ max: 100 }),
    body('click_value_type')
      .isIn(['MIL', 'MOA'])
      .withMessage('Click value type must be MIL or MOA'),
    body('click_value')
      .isFloat({ min: 0.0001, max: 1 })
      .withMessage('Click value must be between 0 and 1'),
    body('scope_height')
      .isFloat({ min: 0.01, max: 10 })
      .withMessage('Scope height must be between 0 and 10 inches'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Notes must not exceed 5000 characters'),
  ]),
  asyncHandler(RifleProfileController.create.bind(RifleProfileController))
);

/**
 * @route   PUT /api/v1/rifles/:id
 * @desc    Update rifle profile
 * @access  Private
 */
router.put(
  '/:id',
  validateId('id'),
  validate([
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Rifle name cannot be empty')
      .isLength({ max: 255 }),
    body('caliber')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 100 }),
    body('barrel_length')
      .optional()
      .isFloat({ min: 0.01, max: 50 }),
    body('twist_rate')
      .optional()
      .trim()
      .matches(/^1:\d+$/),
    body('zero_distance')
      .optional()
      .isFloat({ min: 0.01, max: 1000 }),
    body('optic_manufacturer')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('optic_model')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('reticle_type')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 100 }),
    body('click_value_type')
      .optional()
      .isIn(['MIL', 'MOA']),
    body('click_value')
      .optional()
      .isFloat({ min: 0.0001, max: 1 }),
    body('scope_height')
      .optional()
      .isFloat({ min: 0.01, max: 10 }),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 5000 }),
  ]),
  asyncHandler(RifleProfileController.update.bind(RifleProfileController))
);

/**
 * @route   DELETE /api/v1/rifles/:id
 * @desc    Delete rifle profile
 * @access  Private
 */
router.delete(
  '/:id',
  validateId('id'),
  asyncHandler(RifleProfileController.delete.bind(RifleProfileController))
);

export default router;
