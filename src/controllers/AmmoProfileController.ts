import { Request, Response } from 'express';
import AmmoProfile from '../models/AmmoProfile';
import RifleProfile from '../models/RifleProfile';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';
import { Op } from 'sequelize';

/**
 * Ammo Profile Controller
 *
 * Handles CRUD operations for ammunition profiles.
 */

export class AmmoProfileController {
  /**
   * Get all ammo profiles for authenticated user
   * GET /api/v1/ammo
   */
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { page, limit, offset } = (req as any).pagination;
    const { rifle_id, manufacturer, search } = req.query;

    // Build query
    const where: any = { user_id: userId };

    if (rifle_id) {
      where.rifle_id = rifle_id;
    }

    if (manufacturer) {
      where.manufacturer = manufacturer;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { manufacturer: { [Op.like]: `%${search}%` } },
        { bullet_type: { [Op.like]: `%${search}%` } },
      ];
    }

    // Get ammo with pagination and include rifle
    const { count, rows } = await AmmoProfile.findAndCountAll({
      where,
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
    const userId = (req as any).userId;
    const ammoId = (req as any).idParsed;

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
    const userId = (req as any).userId;

    // Verify rifle belongs to user
    const rifle = await RifleProfile.findOne({
      where: {
        id: req.body.rifle_id,
        user_id: userId,
      },
    });

    if (!rifle) {
      throw new ValidationError('Invalid rifle_id: Rifle not found or does not belong to you');
    }

    const ammo = await AmmoProfile.create({
      ...req.body,
      user_id: userId,
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
    const userId = (req as any).userId;
    const ammoId = (req as any).idParsed;

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
    if (req.body.rifle_id && req.body.rifle_id !== ammo.rifle_id) {
      const rifle = await RifleProfile.findOne({
        where: {
          id: req.body.rifle_id,
          user_id: userId,
        },
      });

      if (!rifle) {
        throw new ValidationError('Invalid rifle_id: Rifle not found or does not belong to you');
      }
    }

    // Update ammo
    await ammo.update(req.body);

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
    const userId = (req as any).userId;
    const ammoId = (req as any).idParsed;

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
    const userId = (req as any).userId;
    const ammoId = (req as any).idParsed;

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
    const stats = await AmmoProfile.sequelize?.query(
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
        type: 'SELECT',
      }
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
