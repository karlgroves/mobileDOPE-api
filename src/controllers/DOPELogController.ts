import { type Request, type Response } from 'express';
import { Op, type WhereOptions, type Order } from 'sequelize';

import AmmoProfile from '../models/AmmoProfile';
import DOPELog from '../models/DOPELog';
import EnvironmentSnapshot from '../models/EnvironmentSnapshot';
import RifleProfile from '../models/RifleProfile';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';

/**
 * DOPE Log Controller
 *
 * Handles CRUD operations for DOPE (Data On Previous Engagements) logs.
 */

interface DOPELogBody {
  rifle_id: number;
  ammo_id: number;
  environment_id: number;
  distance: number;
  distance_unit: 'yards' | 'meters';
  distance_yards?: number;
  elevation_correction: number;
  windage_correction: number;
  correction_unit: 'MIL' | 'MOA';
  target_type: 'steel' | 'paper' | 'vital_zone' | 'other';
  group_size?: number;
  hit_count?: number;
  shot_count?: number;
  hit_percentage?: number;
  notes?: string;
  timestamp?: Date;
}

export class DOPELogController {
  /**
   * Get all DOPE logs for authenticated user
   * GET /api/v1/dope
   */
  async getAll(req: Request, res: Response) {
    const userId = req.userId;
    const { page, limit, offset } = req.pagination!;
    const { rifle_id, ammo_id, distance_min, distance_max, target_type, sort } = req.query as {
      rifle_id?: string;
      ammo_id?: string;
      distance_min?: string;
      distance_max?: string;
      target_type?: string;
      sort?: string;
    };

    // Build query with explicit type casting for all query params
    const where: Record<string | symbol, unknown> = { user_id: userId };

    if (rifle_id) {
      where.rifle_id = parseInt(rifle_id, 10);
    }

    if (ammo_id) {
      where.ammo_id = parseInt(ammo_id, 10);
    }

    if (distance_min || distance_max) {
      const distanceRange: Record<symbol, number> = {};
      if (distance_min) {
        distanceRange[Op.gte] = parseFloat(distance_min);
      }
      if (distance_max) {
        distanceRange[Op.lte] = parseFloat(distance_max);
      }
      where.distance_yards = distanceRange;
    }

    if (target_type) {
      where.target_type = String(target_type);
    }

    // Determine sort order
    let order: Order = [['timestamp', 'DESC']];
    if (sort === 'distance_asc') {
      order = [['distance_yards', 'ASC']];
    } else if (sort === 'distance_desc') {
      order = [['distance_yards', 'DESC']];
    } else if (sort === 'accuracy') {
      order = [['hit_percentage', 'DESC']];
    }

    // Get logs with pagination and includes
    const { count, rows } = await DOPELog.findAndCountAll({
      where: where as WhereOptions,
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
    const userId = req.userId;
    const dopeId = req.idParsed;

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
    const userId = req.userId;
    const body = req.body as DOPELogBody;

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

    // Verify ammo belongs to user
    const ammo = await AmmoProfile.findOne({
      where: {
        id: body.ammo_id,
        user_id: userId,
      },
    });

    if (!ammo) {
      throw new ValidationError('Invalid ammo_id: Ammo not found or does not belong to you');
    }

    // Verify environment belongs to user
    const environment = await EnvironmentSnapshot.findOne({
      where: {
        id: body.environment_id,
        user_id: userId,
      },
    });

    if (!environment) {
      throw new ValidationError(
        'Invalid environment_id: Environment not found or does not belong to you',
      );
    }

    // Create DOPE log with allowed fields only
    const {
      rifle_id,
      ammo_id,
      environment_id,
      distance,
      distance_unit,
      distance_yards,
      elevation_correction,
      windage_correction,
      correction_unit,
      target_type,
      group_size,
      hit_count,
      shot_count,
      hit_percentage,
      notes,
      timestamp,
    } = body;
    const dopeLog = await DOPELog.create({
      rifle_id,
      ammo_id,
      environment_id,
      distance,
      distance_unit,
      distance_yards,
      elevation_correction,
      windage_correction,
      correction_unit,
      target_type,
      group_size,
      hit_count,
      shot_count,
      hit_percentage,
      notes,
      timestamp,
      user_id: userId!,
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
    const userId = req.userId;
    const dopeId = req.idParsed;
    const body = req.body as Partial<DOPELogBody>;

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
    if (body.rifle_id && body.rifle_id !== dopeLog.rifle_id) {
      const rifle = await RifleProfile.findOne({
        where: { id: body.rifle_id, user_id: userId },
      });
      if (!rifle) {
        throw new ValidationError('Invalid rifle_id');
      }
    }

    if (body.ammo_id && body.ammo_id !== dopeLog.ammo_id) {
      const ammo = await AmmoProfile.findOne({
        where: { id: body.ammo_id, user_id: userId },
      });
      if (!ammo) {
        throw new ValidationError('Invalid ammo_id');
      }
    }

    if (body.environment_id && body.environment_id !== dopeLog.environment_id) {
      const environment = await EnvironmentSnapshot.findOne({
        where: { id: body.environment_id, user_id: userId },
      });
      if (!environment) {
        throw new ValidationError('Invalid environment_id');
      }
    }

    // Update log with allowed fields only
    const {
      rifle_id,
      ammo_id,
      environment_id,
      distance,
      distance_unit,
      distance_yards,
      elevation_correction,
      windage_correction,
      correction_unit,
      target_type,
      group_size,
      hit_count,
      shot_count,
      hit_percentage,
      notes,
      timestamp,
    } = body;
    await dopeLog.update({
      rifle_id,
      ammo_id,
      environment_id,
      distance,
      distance_unit,
      distance_yards,
      elevation_correction,
      windage_correction,
      correction_unit,
      target_type,
      group_size,
      hit_count,
      shot_count,
      hit_percentage,
      notes,
      timestamp,
    });

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
    const userId = req.userId;
    const dopeId = req.idParsed;

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
    const userId = req.userId;
    const { rifle_id, ammo_id } = req.query;

    if (!rifle_id || !ammo_id) {
      throw new ValidationError('rifle_id and ammo_id are required');
    }

    const parsedRifleId = parseInt(rifle_id as string, 10);
    const parsedAmmoId = parseInt(ammo_id as string, 10);

    // Verify ownership
    const rifle = await RifleProfile.findOne({
      where: { id: parsedRifleId, user_id: userId },
    });
    const ammo = await AmmoProfile.findOne({
      where: { id: parsedAmmoId, user_id: userId },
    });

    if (!rifle || !ammo) {
      throw new NotFoundError('Rifle or ammo not found');
    }

    // Get all logs for this combination, ordered by distance
    const logs = await DOPELog.findAll({
      where: {
        user_id: userId,
        rifle_id: parsedRifleId,
        ammo_id: parsedAmmoId,
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
