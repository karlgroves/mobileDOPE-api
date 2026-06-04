import { Request, Response } from 'express';
import { Op, WhereOptions, QueryTypes } from 'sequelize';
import RifleProfile from '../models/RifleProfile';
import { NotFoundError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';

/**
 * Rifle Profile Controller
 *
 * Handles CRUD operations for rifle profiles.
 */

interface RifleStats {
  ammo_count: number;
  dope_count: number;
  min_distance: number | null;
  max_distance: number | null;
  avg_accuracy: number | null;
}

interface RifleProfileBody {
  name: string;
  caliber: string;
  barrel_length: number;
  twist_rate: string;
  zero_distance: number;
  optic_manufacturer: string;
  optic_model: string;
  reticle_type: string;
  click_value_type: 'MIL' | 'MOA';
  click_value: number;
  scope_height: number;
  notes?: string;
}

export class RifleProfileController {
  /**
   * Get all rifle profiles for authenticated user
   * GET /api/v1/rifles
   */
  async getAll(req: Request, res: Response) {
    const userId = req.userId;
    const { page, limit, offset } = req.pagination!;
    const caliber = req.query.caliber as string | undefined;
    const search = req.query.search as string | undefined;

    // Build query
    const where: Record<string | symbol, unknown> = { user_id: userId };

    if (caliber) {
      where.caliber = String(caliber);
    }

    if (search) {
      const searchStr = String(search);
      where[Op.or] = [
        { name: { [Op.like]: `%${searchStr}%` } },
        { caliber: { [Op.like]: `%${searchStr}%` } },
      ];
    }

    // Get rifles with pagination
    const { count, rows } = await RifleProfile.findAndCountAll({
      where: where as WhereOptions,
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
    const userId = req.userId;
    const rifleId = req.idParsed;

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
    const userId = req.userId;

    const {
      name,
      caliber,
      barrel_length,
      twist_rate,
      zero_distance,
      optic_manufacturer,
      optic_model,
      reticle_type,
      click_value_type,
      click_value,
      scope_height,
      notes,
    } = req.body as RifleProfileBody;
    const rifle = await RifleProfile.create({
      name,
      caliber,
      barrel_length,
      twist_rate,
      zero_distance,
      optic_manufacturer,
      optic_model,
      reticle_type,
      click_value_type,
      click_value,
      scope_height,
      notes,
      user_id: userId!,
    });

    return sendCreated(res, rifle, 'Rifle profile created successfully');
  }

  /**
   * Update rifle profile
   * PUT /api/v1/rifles/:id
   */
  async update(req: Request, res: Response) {
    const userId = req.userId;
    const rifleId = req.idParsed;

    const rifle = await RifleProfile.findOne({
      where: {
        id: rifleId,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new NotFoundError('Rifle profile');
    }

    // Update rifle with allowed fields only
    const {
      name,
      caliber,
      barrel_length,
      twist_rate,
      zero_distance,
      optic_manufacturer,
      optic_model,
      reticle_type,
      click_value_type,
      click_value,
      scope_height,
      notes,
    } = req.body as RifleProfileBody;
    await rifle.update({
      name,
      caliber,
      barrel_length,
      twist_rate,
      zero_distance,
      optic_manufacturer,
      optic_model,
      reticle_type,
      click_value_type,
      click_value,
      scope_height,
      notes,
    });

    return sendSuccess(res, rifle, 'Rifle profile updated successfully');
  }

  /**
   * Delete rifle profile
   * DELETE /api/v1/rifles/:id
   */
  async delete(req: Request, res: Response) {
    const userId = req.userId;
    const rifleId = req.idParsed;

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
    const userId = req.userId;
    const rifleId = req.idParsed;

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
    const stats = await RifleProfile.sequelize?.query<RifleStats>(
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
        type: QueryTypes.SELECT,
      },
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
