import { Request, Response } from 'express';
import RifleProfile from '../models/RifleProfile';
import { NotFoundError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';
import { Op } from 'sequelize';

/**
 * Rifle Profile Controller
 *
 * Handles CRUD operations for rifle profiles.
 */

export class RifleProfileController {
  /**
   * Get all rifle profiles for authenticated user
   * GET /api/v1/rifles
   */
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { page, limit, offset } = (req as any).pagination;
    const { caliber, search } = req.query;

    // Build query
    const where: any = { user_id: userId };

    if (caliber) {
      where.caliber = caliber;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { caliber: { [Op.like]: `%${search}%` } },
      ];
    }

    // Get rifles with pagination
    const { count, rows } = await RifleProfile.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return sendPaginated(res, rows, page, limit, count);
  }

  /**
   * Get single rifle profile
   * GET /api/v1/rifles/:id
   */
  async getById(req: Request, res: Response) {
    const userId = (req as any).userId;
    const rifleId = (req as any).idParsed;

    const rifle = await RifleProfile.findOne({
      where: {
        id: rifleId,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new NotFoundError('Rifle profile');
    }

    return sendSuccess(res, rifle);
  }

  /**
   * Create new rifle profile
   * POST /api/v1/rifles
   */
  async create(req: Request, res: Response) {
    const userId = (req as any).userId;

    const rifle = await RifleProfile.create({
      ...req.body,
      user_id: userId,
    });

    return sendCreated(res, rifle, 'Rifle profile created successfully');
  }

  /**
   * Update rifle profile
   * PUT /api/v1/rifles/:id
   */
  async update(req: Request, res: Response) {
    const userId = (req as any).userId;
    const rifleId = (req as any).idParsed;

    const rifle = await RifleProfile.findOne({
      where: {
        id: rifleId,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new NotFoundError('Rifle profile');
    }

    // Update rifle
    await rifle.update(req.body);

    return sendSuccess(res, rifle, 'Rifle profile updated successfully');
  }

  /**
   * Delete rifle profile
   * DELETE /api/v1/rifles/:id
   */
  async delete(req: Request, res: Response) {
    const userId = (req as any).userId;
    const rifleId = (req as any).idParsed;

    const rifle = await RifleProfile.findOne({
      where: {
        id: rifleId,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new NotFoundError('Rifle profile');
    }

    await rifle.destroy();

    return sendNoContent(res);
  }

  /**
   * Get rifle summary statistics
   * GET /api/v1/rifles/:id/stats
   */
  async getStats(req: Request, res: Response) {
    const userId = (req as any).userId;
    const rifleId = (req as any).idParsed;

    const rifle = await RifleProfile.findOne({
      where: {
        id: rifleId,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new NotFoundError('Rifle profile');
    }

    // Get associated ammo and DOPE logs count
    const stats = await RifleProfile.sequelize?.query(
      `
      SELECT
        (SELECT COUNT(*) FROM ammo_profiles WHERE rifle_id = :rifleId) as ammo_count,
        (SELECT COUNT(*) FROM dope_logs WHERE rifle_id = :rifleId) as dope_count,
        (SELECT MIN(distance_yards) FROM dope_logs WHERE rifle_id = :rifleId) as min_distance,
        (SELECT MAX(distance_yards) FROM dope_logs WHERE rifle_id = :rifleId) as max_distance,
        (SELECT AVG(hit_percentage) FROM dope_logs WHERE rifle_id = :rifleId AND hit_percentage IS NOT NULL) as avg_accuracy
      `,
      {
        replacements: { rifleId },
        type: 'SELECT',
      }
    );

    return sendSuccess(res, {
      rifle: rifle.toJSON(),
      statistics: stats?.[0] || {
        ammo_count: 0,
        dope_count: 0,
        min_distance: null,
        max_distance: null,
        avg_accuracy: null,
      },
    });
  }
}

export default new RifleProfileController();
