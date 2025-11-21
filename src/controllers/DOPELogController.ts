import { Request, Response } from 'express';
import DOPELog from '../models/DOPELog';
import RifleProfile from '../models/RifleProfile';
import AmmoProfile from '../models/AmmoProfile';
import EnvironmentSnapshot from '../models/EnvironmentSnapshot';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';
import { Op } from 'sequelize';

/**
 * DOPE Log Controller
 *
 * Handles CRUD operations for DOPE (Data On Previous Engagements) logs.
 */

export class DOPELogController {
  /**
   * Get all DOPE logs for authenticated user
   * GET /api/v1/dope
   */
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { page, limit, offset } = (req as any).pagination;
    const { rifle_id, ammo_id, distance_min, distance_max, target_type, sort } = req.query;

    // Build query
    const where: any = { user_id: userId };

    if (rifle_id) {
      where.rifle_id = rifle_id;
    }

    if (ammo_id) {
      where.ammo_id = ammo_id;
    }

    if (distance_min || distance_max) {
      where.distance_yards = {};
      if (distance_min) {
        where.distance_yards[Op.gte] = distance_min;
      }
      if (distance_max) {
        where.distance_yards[Op.lte] = distance_max;
      }
    }

    if (target_type) {
      where.target_type = target_type;
    }

    // Determine sort order
    let order: any = [['timestamp', 'DESC']];
    if (sort === 'distance_asc') {
      order = [['distance_yards', 'ASC']];
    } else if (sort === 'distance_desc') {
      order = [['distance_yards', 'DESC']];
    } else if (sort === 'accuracy') {
      order = [['hit_percentage', 'DESC']];
    }

    // Get logs with pagination and includes
    const { count, rows } = await DOPELog.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
        {
          model: AmmoProfile,
          as: 'ammo',
          attributes: ['id', 'name', 'manufacturer', 'bullet_weight'],
        },
        {
          model: EnvironmentSnapshot,
          as: 'environment',
          attributes: ['id', 'temperature', 'humidity', 'pressure', 'wind_speed', 'wind_direction'],
        },
      ],
    });

    return sendPaginated(res, rows, page, limit, count);
  }

  /**
   * Get single DOPE log
   * GET /api/v1/dope/:id
   */
  async getById(req: Request, res: Response) {
    const userId = (req as any).userId;
    const dopeId = (req as any).idParsed;

    const dopeLog = await DOPELog.findOne({
      where: {
        id: dopeId,
        user_id: userId,
      },
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
        },
        {
          model: AmmoProfile,
          as: 'ammo',
        },
        {
          model: EnvironmentSnapshot,
          as: 'environment',
        },
      ],
    });

    if (!dopeLog) {
      throw new NotFoundError('DOPE log');
    }

    return sendSuccess(res, dopeLog);
  }

  /**
   * Create new DOPE log
   * POST /api/v1/dope
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

    // Verify ammo belongs to user
    const ammo = await AmmoProfile.findOne({
      where: {
        id: req.body.ammo_id,
        user_id: userId,
      },
    });

    if (!ammo) {
      throw new ValidationError('Invalid ammo_id: Ammo not found or does not belong to you');
    }

    // Verify environment belongs to user
    const environment = await EnvironmentSnapshot.findOne({
      where: {
        id: req.body.environment_id,
        user_id: userId,
      },
    });

    if (!environment) {
      throw new ValidationError('Invalid environment_id: Environment not found or does not belong to you');
    }

    // Create DOPE log
    const dopeLog = await DOPELog.create({
      ...req.body,
      user_id: userId,
    });

    // Load relationships
    await dopeLog.reload({
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
        {
          model: AmmoProfile,
          as: 'ammo',
          attributes: ['id', 'name', 'manufacturer'],
        },
        {
          model: EnvironmentSnapshot,
          as: 'environment',
          attributes: ['id', 'temperature', 'wind_speed'],
        },
      ],
    });

    return sendCreated(res, dopeLog, 'DOPE log created successfully');
  }

  /**
   * Update DOPE log
   * PUT /api/v1/dope/:id
   */
  async update(req: Request, res: Response) {
    const userId = (req as any).userId;
    const dopeId = (req as any).idParsed;

    const dopeLog = await DOPELog.findOne({
      where: {
        id: dopeId,
        user_id: userId,
      },
    });

    if (!dopeLog) {
      throw new NotFoundError('DOPE log');
    }

    // Validate any changed foreign keys
    if (req.body.rifle_id && req.body.rifle_id !== dopeLog.rifle_id) {
      const rifle = await RifleProfile.findOne({
        where: { id: req.body.rifle_id, user_id: userId },
      });
      if (!rifle) {
        throw new ValidationError('Invalid rifle_id');
      }
    }

    if (req.body.ammo_id && req.body.ammo_id !== dopeLog.ammo_id) {
      const ammo = await AmmoProfile.findOne({
        where: { id: req.body.ammo_id, user_id: userId },
      });
      if (!ammo) {
        throw new ValidationError('Invalid ammo_id');
      }
    }

    if (req.body.environment_id && req.body.environment_id !== dopeLog.environment_id) {
      const environment = await EnvironmentSnapshot.findOne({
        where: { id: req.body.environment_id, user_id: userId },
      });
      if (!environment) {
        throw new ValidationError('Invalid environment_id');
      }
    }

    // Update log
    await dopeLog.update(req.body);

    // Reload with relationships
    await dopeLog.reload({
      include: [
        {
          model: RifleProfile,
          as: 'rifle',
          attributes: ['id', 'name', 'caliber'],
        },
        {
          model: AmmoProfile,
          as: 'ammo',
          attributes: ['id', 'name', 'manufacturer'],
        },
        {
          model: EnvironmentSnapshot,
          as: 'environment',
        },
      ],
    });

    return sendSuccess(res, dopeLog, 'DOPE log updated successfully');
  }

  /**
   * Delete DOPE log
   * DELETE /api/v1/dope/:id
   */
  async delete(req: Request, res: Response) {
    const userId = (req as any).userId;
    const dopeId = (req as any).idParsed;

    const dopeLog = await DOPELog.findOne({
      where: {
        id: dopeId,
        user_id: userId,
      },
    });

    if (!dopeLog) {
      throw new NotFoundError('DOPE log');
    }

    await dopeLog.destroy();

    return sendNoContent(res);
  }

  /**
   * Get DOPE card data (all logs for a rifle/ammo combination)
   * GET /api/v1/dope/card
   */
  async getCard(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { rifle_id, ammo_id } = req.query;

    if (!rifle_id || !ammo_id) {
      throw new ValidationError('rifle_id and ammo_id are required');
    }

    // Verify ownership
    const rifle = await RifleProfile.findOne({
      where: { id: rifle_id, user_id: userId },
    });
    const ammo = await AmmoProfile.findOne({
      where: { id: ammo_id, user_id: userId },
    });

    if (!rifle || !ammo) {
      throw new NotFoundError('Rifle or ammo not found');
    }

    // Get all logs for this combination, ordered by distance
    const logs = await DOPELog.findAll({
      where: {
        user_id: userId,
        rifle_id,
        ammo_id,
      },
      order: [['distance_yards', 'ASC']],
      attributes: [
        'distance',
        'distance_unit',
        'distance_yards',
        'elevation_correction',
        'windage_correction',
        'correction_unit',
        'hit_percentage',
        'group_size',
      ],
    });

    return sendSuccess(res, {
      rifle: rifle.toJSON(),
      ammo: ammo.toJSON(),
      dope_data: logs,
      generated_at: new Date().toISOString(),
    });
  }
}

export default new DOPELogController();
