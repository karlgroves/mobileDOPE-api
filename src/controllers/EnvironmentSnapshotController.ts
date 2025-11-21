import { Request, Response } from 'express';
import EnvironmentSnapshot from '../models/EnvironmentSnapshot';
import { NotFoundError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';
import { Op } from 'sequelize';

/**
 * Environment Snapshot Controller
 *
 * Handles CRUD operations for environmental condition snapshots.
 */

export class EnvironmentSnapshotController {
  /**
   * Get all environment snapshots for authenticated user
   * GET /api/v1/environment
   */
  async getAll(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { page, limit, offset } = (req as any).pagination;
    const { temp_min, temp_max, date_from, date_to } = req.query;

    // Build query
    const where: any = { user_id: userId };

    if (temp_min || temp_max) {
      where.temperature = {};
      if (temp_min) {
        where.temperature[Op.gte] = temp_min;
      }
      if (temp_max) {
        where.temperature[Op.lte] = temp_max;
      }
    }

    if (date_from || date_to) {
      where.timestamp = {};
      if (date_from) {
        where.timestamp[Op.gte] = new Date(date_from as string);
      }
      if (date_to) {
        where.timestamp[Op.lte] = new Date(date_to as string);
      }
    }

    // Get snapshots with pagination
    const { count, rows } = await EnvironmentSnapshot.findAndCountAll({
      where,
      limit,
      offset,
      order: [['timestamp', 'DESC']],
    });

    return sendPaginated(res, rows, page, limit, count);
  }

  /**
   * Get single environment snapshot
   * GET /api/v1/environment/:id
   */
  async getById(req: Request, res: Response) {
    const userId = (req as any).userId;
    const envId = (req as any).idParsed;

    const snapshot = await EnvironmentSnapshot.findOne({
      where: {
        id: envId,
        user_id: userId,
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Environment snapshot');
    }

    return sendSuccess(res, snapshot);
  }

  /**
   * Create new environment snapshot
   * POST /api/v1/environment
   */
  async create(req: Request, res: Response) {
    const userId = (req as any).userId;

    // Density altitude will be auto-calculated by model hook
    const snapshot = await EnvironmentSnapshot.create({
      ...req.body,
      user_id: userId,
    });

    return sendCreated(res, snapshot, 'Environment snapshot created successfully');
  }

  /**
   * Update environment snapshot
   * PUT /api/v1/environment/:id
   */
  async update(req: Request, res: Response) {
    const userId = (req as any).userId;
    const envId = (req as any).idParsed;

    const snapshot = await EnvironmentSnapshot.findOne({
      where: {
        id: envId,
        user_id: userId,
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Environment snapshot');
    }

    // Update snapshot (density altitude will be recalculated if needed)
    await snapshot.update(req.body);

    return sendSuccess(res, snapshot, 'Environment snapshot updated successfully');
  }

  /**
   * Delete environment snapshot
   * DELETE /api/v1/environment/:id
   */
  async delete(req: Request, res: Response) {
    const userId = (req as any).userId;
    const envId = (req as any).idParsed;

    const snapshot = await EnvironmentSnapshot.findOne({
      where: {
        id: envId,
        user_id: userId,
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Environment snapshot');
    }

    // Check if snapshot is used by any DOPE logs
    const usageCount = await EnvironmentSnapshot.sequelize?.query(
      'SELECT COUNT(*) as count FROM dope_logs WHERE environment_id = ?',
      {
        replacements: [envId],
        type: 'SELECT',
      }
    );

    const count = (usageCount as any)?.[0]?.count || 0;

    if (count > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete environment snapshot: it is used by ${count} DOPE log(s)`,
        timestamp: new Date().toISOString(),
      });
    }

    await snapshot.destroy();

    return sendNoContent(res);
  }

  /**
   * Get current conditions (most recent snapshot)
   * GET /api/v1/environment/current
   */
  async getCurrent(req: Request, res: Response) {
    const userId = (req as any).userId;

    const snapshot = await EnvironmentSnapshot.findOne({
      where: {
        user_id: userId,
      },
      order: [['timestamp', 'DESC']],
    });

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: 'No environment snapshots found',
        timestamp: new Date().toISOString(),
      });
    }

    return sendSuccess(res, snapshot);
  }

  /**
   * Get average conditions for a date range
   * GET /api/v1/environment/averages
   */
  async getAverages(req: Request, res: Response) {
    const userId = (req as any).userId;
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        success: false,
        message: 'date_from and date_to are required',
        timestamp: new Date().toISOString(),
      });
    }

    const averages = await EnvironmentSnapshot.sequelize?.query(
      `
      SELECT
        COUNT(*) as snapshot_count,
        AVG(temperature) as avg_temperature,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        AVG(humidity) as avg_humidity,
        AVG(pressure) as avg_pressure,
        AVG(altitude) as avg_altitude,
        AVG(density_altitude) as avg_density_altitude,
        AVG(wind_speed) as avg_wind_speed
      FROM environment_snapshots
      WHERE user_id = :userId
        AND timestamp >= :dateFrom
        AND timestamp <= :dateTo
      `,
      {
        replacements: {
          userId,
          dateFrom: new Date(date_from as string),
          dateTo: new Date(date_to as string),
        },
        type: 'SELECT',
      }
    );

    return sendSuccess(res, {
      date_range: {
        from: date_from,
        to: date_to,
      },
      averages: averages?.[0] || null,
    });
  }
}

export default new EnvironmentSnapshotController();
