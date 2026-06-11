import { type Request, type Response } from 'express';
import { Op, type WhereOptions, QueryTypes } from 'sequelize';

import AmmoProfile from '../models/AmmoProfile';
import RifleProfile from '../models/RifleProfile';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';

/**
 * Ammo Profile Controller
 *
 * Handles CRUD operations for ammunition profiles.
 */

interface AmmoProfileBody {
  rifle_id: number;
  name: string;
  manufacturer: string;
  bullet_weight: number;
  bullet_type: string;
  ballistic_coefficient_g1: number;
  ballistic_coefficient_g7: number;
  muzzle_velocity: number;
  powder_type?: string;
  powder_weight?: number;
  lot_number?: string;
  notes?: string;
}

interface AmmoStats {
  dope_count: number;
  min_distance: number | null;
  max_distance: number | null;
  avg_accuracy: number | null;
  avg_group_size: number | null;
}

export class AmmoProfileController {
  /**
   * Get all ammo profiles for authenticated user
   * GET /api/v1/ammo
   */
  async getAll(req: Request, res: Response) {
    const userId = req.userId;
    const { page, limit, offset } = req.pagination!;
    const rifle_id = req.query.rifle_id as string | undefined;
    const manufacturer = req.query.manufacturer as string | undefined;
    const search = req.query.search as string | undefined;

    // Build query
    const where: Record<string | symbol, unknown> = { user_id: userId };

    if (rifle_id) {
      where.rifle_id = parseInt(rifle_id, 10);
    }

    if (manufacturer) {
      where.manufacturer = String(manufacturer);
    }

    if (search) {
      const searchStr = String(search);
      where[Op.or] = [
        { name: { [Op.like]: `%${searchStr}%` } },
        { manufacturer: { [Op.like]: `%${searchStr}%` } },
        { bullet_type: { [Op.like]: `%${searchStr}%` } },
      ];
    }

    // Get ammo with pagination and include rifle
    const { count, rows } = await AmmoProfile.findAndCountAll({
      where: where as WhereOptions,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
      ],
    });

    return sendPaginated(res, rows, page, limit, count);
  }

  /**
   * Get single ammo profile
   * GET /api/v1/ammo/:id
   */
  async getById(req: Request, res: Response) {
    const userId = req.userId;
    const ammoId = req.idParsed;

    const ammo = await AmmoProfile.findOne({
      where: {
        id: ammoId,
        user_id: userId,
      },
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
      ],
    });

    if (!ammo) {
      throw new NotFoundError('Ammo profile');
    }

    return sendSuccess(res, ammo);
  }

  /**
   * Create new ammo profile
   * POST /api/v1/ammo
   */
  async create(req: Request, res: Response) {
    const userId = req.userId;
    const body = req.body as AmmoProfileBody;

    // Verify rifle belongs to user
    const rifle = await RifleProfile.findOne({
      where: {
        id: body.rifle_id,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new ValidationError('Invalid rifle_id: Rifle not found or does not belong to you');
    }

    const {
      rifle_id,
      name,
      manufacturer,
      bullet_weight,
      bullet_type,
      ballistic_coefficient_g1,
      ballistic_coefficient_g7,
      muzzle_velocity,
      powder_type,
      powder_weight,
      lot_number,
      notes,
    } = body;
    const ammo = await AmmoProfile.create({
      rifle_id,
      name,
      manufacturer,
      bullet_weight,
      bullet_type,
      ballistic_coefficient_g1,
      ballistic_coefficient_g7,
      muzzle_velocity,
      powder_type,
      powder_weight,
      lot_number,
      notes,
      user_id: userId!,
    });

    // Load rifle relationship
    await ammo.reload({
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
      ],
    });

    return sendCreated(res, ammo, 'Ammo profile created successfully');
  }

  /**
   * Update ammo profile
   * PUT /api/v1/ammo/:id
   */
  async update(req: Request, res: Response) {
    const userId = req.userId;
    const ammoId = req.idParsed;
    const body = req.body as Partial<AmmoProfileBody>;

    const ammo = await AmmoProfile.findOne({
      where: {
        id: ammoId,
        user_id: userId,
      },
    });

    if (!ammo) {
      throw new NotFoundError('Ammo profile');
    }

    // If updating rifle_id, verify it belongs to user
    if (body.rifle_id && body.rifle_id !== ammo.rifle_id) {
      const rifle = await RifleProfile.findOne({
        where: {
          id: body.rifle_id,
          user_id: userId,
        },
      });

      if (!rifle) {
        throw new ValidationError('Invalid rifle_id: Rifle not found or does not belong to you');
      }
    }

    // Update ammo with allowed fields only
    const {
      rifle_id,
      name,
      manufacturer,
      bullet_weight,
      bullet_type,
      ballistic_coefficient_g1,
      ballistic_coefficient_g7,
      muzzle_velocity,
      powder_type,
      powder_weight,
      lot_number,
      notes,
    } = body;
    await ammo.update({
      rifle_id,
      name,
      manufacturer,
      bullet_weight,
      bullet_type,
      ballistic_coefficient_g1,
      ballistic_coefficient_g7,
      muzzle_velocity,
      powder_type,
      powder_weight,
      lot_number,
      notes,
    });

    // Reload with rifle
    await ammo.reload({
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
      ],
    });

    return sendSuccess(res, ammo, 'Ammo profile updated successfully');
  }

  /**
   * Delete ammo profile
   * DELETE /api/v1/ammo/:id
   */
  async delete(req: Request, res: Response) {
    const userId = req.userId;
    const ammoId = req.idParsed;

    const ammo = await AmmoProfile.findOne({
      where: {
        id: ammoId,
        user_id: userId,
      },
    });

    if (!ammo) {
      throw new NotFoundError('Ammo profile');
    }

    await ammo.destroy();

    return sendNoContent(res);
  }

  /**
   * Get ammo performance statistics
   * GET /api/v1/ammo/:id/stats
   */
  async getStats(req: Request, res: Response) {
    const userId = req.userId;
    const ammoId = req.idParsed;

    const ammo = await AmmoProfile.findOne({
      where: {
        id: ammoId,
        user_id: userId,
      },
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
      ],
    });

    if (!ammo) {
      throw new NotFoundError('Ammo profile');
    }

    // Get DOPE log statistics
    const stats = await AmmoProfile.sequelize?.query<AmmoStats>(
      `
      SELECT
        COUNT(*) as dope_count,
        MIN(distance_yards) as min_distance,
        MAX(distance_yards) as max_distance,
        AVG(hit_percentage) as avg_accuracy,
        AVG(group_size) as avg_group_size
      FROM dope_logs
      WHERE ammo_id = :ammoId AND hit_percentage IS NOT NULL
      `,
      {
        replacements: { ammoId },
        type: QueryTypes.SELECT,
      },
    );

    return sendSuccess(res, {
      ammo: ammo.toJSON(),
      statistics: stats?.[0] || {
        dope_count: 0,
        min_distance: null,
        max_distance: null,
        avg_accuracy: null,
        avg_group_size: null,
      },
    });
  }
}

export default new AmmoProfileController();
