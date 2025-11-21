import { Router } from 'express';
import { body, query } from 'express-validator';
import DOPELogController from '../controllers/DOPELogController';
import { validate, validatePagination, validateId } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/errorHandler';

/**
 * DOPE Log Routes
 *
 * Defines all DOPE log endpoints with validation.
 */

const router = Router();

// All DOPE routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/dope/card
 * @desc    Get DOPE card data for rifle/ammo combination
 * @access  Private
 */
router.get(
  '/card',
  validate([
    query('rifle_id').isInt({ min: 1 }).withMessage('Valid rifle_id is required'),
    query('ammo_id').isInt({ min: 1 }).withMessage('Valid ammo_id is required'),
  ]),
  asyncHandler(DOPELogController.getCard.bind(DOPELogController))
);

/**
 * @route   GET /api/v1/dope
 * @desc    Get all DOPE logs for authenticated user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validate([
    query('rifle_id').optional().isInt({ min: 1 }),
    query('ammo_id').optional().isInt({ min: 1 }),
    query('distance_min').optional().isFloat({ min: 0 }),
    query('distance_max').optional().isFloat({ min: 0, max: 3000 }),
    query('target_type').optional().isIn(['steel', 'paper', 'vital_zone', 'other']),
    query('sort').optional().isIn(['distance_asc', 'distance_desc', 'accuracy', 'date']),
  ]),
  asyncHandler(DOPELogController.getAll.bind(DOPELogController))
);

/**
 * @route   GET /api/v1/dope/:id
 * @desc    Get single DOPE log
 * @access  Private
 */
router.get(
  '/:id',
  validateId('id'),
  asyncHandler(DOPELogController.getById.bind(DOPELogController))
);

/**
 * @route   POST /api/v1/dope
 * @desc    Create new DOPE log
 * @access  Private
 */
router.post(
  '/',
  validate([
    body('rifle_id')
      .isInt({ min: 1 })
      .withMessage('Valid rifle ID is required'),
    body('ammo_id')
      .isInt({ min: 1 })
      .withMessage('Valid ammo ID is required'),
    body('environment_id')
      .isInt({ min: 1 })
      .withMessage('Valid environment ID is required'),
    body('distance')
      .isFloat({ min: 0.01, max: 3000 })
      .withMessage('Distance must be between 0 and 3000'),
    body('distance_unit')
      .isIn(['yards', 'meters'])
      .withMessage('Distance unit must be yards or meters'),
    body('elevation_correction')
      .isFloat()
      .withMessage('Elevation correction must be a number'),
    body('windage_correction')
      .isFloat()
      .withMessage('Windage correction must be a number'),
    body('correction_unit')
      .isIn(['MIL', 'MOA'])
      .withMessage('Correction unit must be MIL or MOA'),
    body('target_type')
      .isIn(['steel', 'paper', 'vital_zone', 'other'])
      .withMessage('Invalid target type'),
    body('group_size')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Group size must be positive'),
    body('hit_count')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Hit count must be a non-negative integer'),
    body('shot_count')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Shot count must be a non-negative integer'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 5000 }),
  ]),
  asyncHandler(DOPELogController.create.bind(DOPELogController))
);

/**
 * @route   PUT /api/v1/dope/:id
 * @desc    Update DOPE log
 * @access  Private
 */
router.put(
  '/:id',
  validateId('id'),
  validate([
    body('rifle_id').optional().isInt({ min: 1 }),
    body('ammo_id').optional().isInt({ min: 1 }),
    body('environment_id').optional().isInt({ min: 1 }),
    body('distance').optional().isFloat({ min: 0.01, max: 3000 }),
    body('distance_unit').optional().isIn(['yards', 'meters']),
    body('elevation_correction').optional().isFloat(),
    body('windage_correction').optional().isFloat(),
    body('correction_unit').optional().isIn(['MIL', 'MOA']),
    body('target_type').optional().isIn(['steel', 'paper', 'vital_zone', 'other']),
    body('group_size').optional().isFloat({ min: 0 }),
    body('hit_count').optional().isInt({ min: 0 }),
    body('shot_count').optional().isInt({ min: 0 }),
    body('notes').optional().trim().isLength({ max: 5000 }),
  ]),
  asyncHandler(DOPELogController.update.bind(DOPELogController))
);

/**
 * @route   DELETE /api/v1/dope/:id
 * @desc    Delete DOPE log
 * @access  Private
 */
router.delete(
  '/:id',
  validateId('id'),
  asyncHandler(DOPELogController.delete.bind(DOPELogController))
);

export default router;
