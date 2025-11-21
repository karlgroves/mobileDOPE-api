import { Router } from 'express';
import { body, query } from 'express-validator';
import AmmoProfileController from '../controllers/AmmoProfileController';
import { validate, validatePagination, validateId } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

/**
 * Ammo Profile Routes
 *
 * Defines all ammunition profile endpoints with validation.
 */

const router = Router();

// All ammo routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/ammo
 * @desc    Get all ammo profiles for authenticated user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validate([
    query('rifle_id').optional().isInt({ min: 1 }),
    query('manufacturer').optional().trim().isLength({ max: 255 }),
    query('search').optional().trim().isLength({ max: 255 }),
  ]),
  asyncHandler(AmmoProfileController.getAll.bind(AmmoProfileController))
);

/**
 * @route   GET /api/v1/ammo/:id
 * @desc    Get single ammo profile
 * @access  Private
 */
router.get(
  '/:id',
  validateId('id'),
  asyncHandler(AmmoProfileController.getById.bind(AmmoProfileController))
);

/**
 * @route   GET /api/v1/ammo/:id/stats
 * @desc    Get ammo performance statistics
 * @access  Private
 */
router.get(
  '/:id/stats',
  validateId('id'),
  asyncHandler(AmmoProfileController.getStats.bind(AmmoProfileController))
);

/**
 * @route   POST /api/v1/ammo
 * @desc    Create new ammo profile
 * @access  Private
 */
router.post(
  '/',
  validate([
    body('rifle_id')
      .isInt({ min: 1 })
      .withMessage('Valid rifle ID is required'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Ammo name is required')
      .isLength({ max: 255 }),
    body('manufacturer')
      .trim()
      .notEmpty()
      .withMessage('Manufacturer is required')
      .isLength({ max: 255 }),
    body('bullet_weight')
      .isFloat({ min: 0.01, max: 1000 })
      .withMessage('Bullet weight must be between 0 and 1000 grains'),
    body('bullet_type')
      .trim()
      .notEmpty()
      .withMessage('Bullet type is required')
      .isLength({ max: 100 }),
    body('ballistic_coefficient_g1')
      .isFloat({ min: 0, max: 1 })
      .withMessage('G1 BC must be between 0 and 1'),
    body('ballistic_coefficient_g7')
      .isFloat({ min: 0, max: 1 })
      .withMessage('G7 BC must be between 0 and 1'),
    body('muzzle_velocity')
      .isFloat({ min: 0.01, max: 5000 })
      .withMessage('Muzzle velocity must be between 0 and 5000 fps'),
    body('powder_type')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('powder_weight')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Powder weight must be positive'),
    body('lot_number')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 5000 }),
  ]),
  asyncHandler(AmmoProfileController.create.bind(AmmoProfileController))
);

/**
 * @route   PUT /api/v1/ammo/:id
 * @desc    Update ammo profile
 * @access  Private
 */
router.put(
  '/:id',
  validateId('id'),
  validate([
    body('rifle_id')
      .optional()
      .isInt({ min: 1 }),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('manufacturer')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 255 }),
    body('bullet_weight')
      .optional()
      .isFloat({ min: 0.01, max: 1000 }),
    body('bullet_type')
      .optional()
      .trim()
      .notEmpty()
      .isLength({ max: 100 }),
    body('ballistic_coefficient_g1')
      .optional()
      .isFloat({ min: 0, max: 1 }),
    body('ballistic_coefficient_g7')
      .optional()
      .isFloat({ min: 0, max: 1 }),
    body('muzzle_velocity')
      .optional()
      .isFloat({ min: 0.01, max: 5000 }),
    body('powder_type')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('powder_weight')
      .optional()
      .isFloat({ min: 0 }),
    body('lot_number')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 5000 }),
  ]),
  asyncHandler(AmmoProfileController.update.bind(AmmoProfileController))
);

/**
 * @route   DELETE /api/v1/ammo/:id
 * @desc    Delete ammo profile
 * @access  Private
 */
router.delete(
  '/:id',
  validateId('id'),
  asyncHandler(AmmoProfileController.delete.bind(AmmoProfileController))
);

export default router;
