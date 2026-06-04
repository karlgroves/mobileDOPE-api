import { Request, Response } from 'express';
import { Op, WhereOptions, QueryTypes } from 'sequelize';
import EnvironmentSnapshot from '../models/EnvironmentSnapshot';
import { NotFoundError } from '../utils/errors';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../utils/response';

/**
 * Environment Snapshot Controller
 *
 * Handles CRUD operations for environmental condition snapshots.
 */

interface EnvironmentSnapshotBody {
  temperature: number;
  humidity: number;
  pressure: number;
  altitude: number;
  density_altitude?: number;
  wind_speed: number;
  wind_direction: number;
  latitude?: number;
  longitude?: number;
  timestamp?: Date;
}

interface UsageCountRow {
  count: number;
}

interface EnvironmentAverages {
  snapshot_count: number;
  avg_temperature: number | null;
  min_temperature: number | null;
  max_temperature: number | null;
  avg_humidity: number | null;
  avg_pressure: number | null;
  avg_altitude: number | null;
  avg_density_altitude: number | null;
  avg_wind_speed: number | null;
}

export class EnvironmentSnapshotController {
  /**
   * Get all environment snapshots for authenticated user
   * GET /api/v1/environment
   */
  async getAll(req: Request, res: Response) {
    const userId = req.userId;
    const { page, limit, offset } = req.pagination!;
    const temp_min = req.query.temp_min as string | undefined;
    const temp_max = req.query.temp_max as string | undefined;
    const date_from = req.query.date_from as string | undefined;
    const date_to = req.query.date_to as string | undefined;

    // Build query
    const where: Record<string | symbol, unknown> = { user_id: userId };

    if (temp_min || temp_max) {
      const tempRange: Record<symbol, number> = {};
      if (temp_min) {
        tempRange[Op.gte] = parseFloat(temp_min);
      }
      if (temp_max) {
        tempRange[Op.lte] = parseFloat(temp_max);
      }
      where.temperature = tempRange;
    }

    if (date_from || date_to) {
      const timestampRange: Record<symbol, Date> = {};
      if (date_from) {
        timestampRange[Op.gte] = new Date(String(date_from));
      }
      if (date_to) {
        timestampRange[Op.lte] = new Date(String(date_to));
      }
      where.timestamp = timestampRange;
    }

    // Get snapshots with pagination
    const { count, rows } = await EnvironmentSnapshot.findAndCountAll({
      where: where as WhereOptions,
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
    const userId = req.userId;
    const envId = req.idParsed;

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
    const userId = req.userId;

    // Density altitude will be auto-calculated by model hook
    const {
      temperature,
      humidity,
      pressure,
      altitude,
      density_altitude,
      wind_speed,
      wind_direction,
      latitude,
      longitude,
      timestamp,
    } = req.body as EnvironmentSnapshotBody;
    const snapshot = await EnvironmentSnapshot.create({
      temperature,
      humidity,
      pressure,
      altitude,
      density_altitude,
      wind_speed,
      wind_direction,
      latitude,
      longitude,
      timestamp,
      user_id: userId!,
    });

    return sendCreated(res, snapshot, 'Environment snapshot created successfully');
  }

  /**
   * Update environment snapshot
   * PUT /api/v1/environment/:id
   */
  async update(req: Request, res: Response) {
    const userId = req.userId;
    const envId = req.idParsed;

    const snapshot = await EnvironmentSnapshot.findOne({
      where: {
        id: envId,
        user_id: userId,
      },
    });

    if (!snapshot) {
      throw new NotFoundError('Environment snapshot');
    }

    // Update snapshot with allowed fields only (density altitude will be recalculated if needed)
    const {
      temperature,
      humidity,
      pressure,
      altitude,
      density_altitude,
      wind_speed,
      wind_direction,
      latitude,
      longitude,
      timestamp,
    } = req.body as Partial<EnvironmentSnapshotBody>;
    await snapshot.update({
      temperature,
      humidity,
      pressure,
      altitude,
      density_altitude,
      wind_speed,
      wind_direction,
      latitude,
      longitude,
      timestamp,
    });

    return sendSuccess(res, snapshot, 'Environment snapshot updated successfully');
  }

  /**
   * Delete environment snapshot
   * DELETE /api/v1/environment/:id
   */
  async delete(req: Request, res: Response) {
    const userId = req.userId;
    const envId = req.idParsed;

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
    const usageCount = await EnvironmentSnapshot.sequelize?.query<UsageCountRow>(
      'SELECT COUNT(*) as count FROM dope_logs WHERE environment_id = ?',
      {
        replacements: [envId],
        type: QueryTypes.SELECT,
      },
    );

    const count = usageCount?.[0]?.count || 0;

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
    const userId = req.userId;

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
    const userId = req.userId;
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
      return res.status(400).json({
        success: false,
        message: 'date_from and date_to are required',
        timestamp: new Date().toISOString(),
      });
    }

    const averages = await EnvironmentSnapshot.sequelize?.query<EnvironmentAverages>(
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
        type: QueryTypes.SELECT,
      },
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
