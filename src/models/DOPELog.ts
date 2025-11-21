import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import RifleProfile from './RifleProfile';
import AmmoProfile from './AmmoProfile';
import EnvironmentSnapshot from './EnvironmentSnapshot';

/**
 * DOPELog Model
 *
 * Core DOPE (Data On Previous Engagements) records.
 * Links rifle, ammo, environment, and shooting performance data.
 */

interface DOPELogAttributes {
  id: number;
  user_id: number;
  rifle_id: number;
  ammo_id: number;
  environment_id: number;
  distance: number;
  distance_unit: 'yards' | 'meters';
  distance_yards: number; // Generated column
  elevation_correction: number; // MIL or MOA
  windage_correction: number; // MIL or MOA
  correction_unit: 'MIL' | 'MOA';
  target_type: 'steel' | 'paper' | 'vital_zone' | 'other';
  group_size?: number; // inches
  hit_count?: number;
  shot_count?: number;
  hit_percentage?: number; // Generated column
  notes?: string;
  timestamp?: Date;
}

interface DOPELogCreationAttributes extends Optional<DOPELogAttributes, 'id' | 'distance_yards' | 'hit_percentage' | 'timestamp'> {}

class DOPELog extends Model<DOPELogAttributes, DOPELogCreationAttributes> implements DOPELogAttributes {
  public id!: number;
  public user_id!: number;
  public rifle_id!: number;
  public ammo_id!: number;
  public environment_id!: number;
  public distance!: number;
  public distance_unit!: 'yards' | 'meters';
  public distance_yards!: number;
  public elevation_correction!: number;
  public windage_correction!: number;
  public correction_unit!: 'MIL' | 'MOA';
  public target_type!: 'steel' | 'paper' | 'vital_zone' | 'other';
  public group_size?: number;
  public hit_count?: number;
  public shot_count?: number;
  public hit_percentage?: number;
  public notes?: string;
  public readonly timestamp!: Date;

  // Associations
  public readonly user?: User;
  public readonly rifle?: RifleProfile;
  public readonly ammo?: AmmoProfile;
  public readonly environment?: EnvironmentSnapshot;

  public static associations: {
    user: Association<DOPELog, User>;
    rifle: Association<DOPELog, RifleProfile>;
    ammo: Association<DOPELog, AmmoProfile>;
    environment: Association<DOPELog, EnvironmentSnapshot>;
  };

  /**
   * Convert distance to yards
   */
  public static convertToYards(distance: number, unit: 'yards' | 'meters'): number {
    return unit === 'yards' ? distance : distance * 1.09361;
  }

  /**
   * Convert distance to meters
   */
  public static convertToMeters(distance: number, unit: 'yards' | 'meters'): number {
    return unit === 'meters' ? distance : distance / 1.09361;
  }

  /**
   * Calculate hit percentage
   */
  public calculateHitPercentage(): number | null {
    if (!this.hit_count || !this.shot_count || this.shot_count === 0) {
      return null;
    }
    return (this.hit_count / this.shot_count) * 100;
  }

  /**
   * Get DOPE card entry string
   */
  public getDOPEEntry(): string {
    const dist = `${this.distance}${this.distance_unit === 'yards' ? 'yd' : 'm'}`;
    const elev = `${this.elevation_correction.toFixed(2)}`;
    const wind = `${this.windage_correction.toFixed(2)}`;
    return `${dist}: ↑${elev} →${wind} ${this.correction_unit}`;
  }

  /**
   * Get log summary
   */
  public getSummary(): string {
    const accuracy = this.hit_percentage ? ` (${this.hit_percentage.toFixed(0)}% hits)` : '';
    return `${this.distance}${this.distance_unit === 'yards' ? 'yd' : 'm'} - ${this.target_type}${accuracy}`;
  }
}

DOPELog.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    rifle_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'rifle_profiles',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    ammo_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'ammo_profiles',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    environment_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'environment_snapshots',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    distance: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 3000,
      },
    },
    distance_unit: {
      type: DataTypes.ENUM('yards', 'meters'),
      allowNull: false,
    },
    distance_yards: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      // Generated column in MySQL - calculated automatically
      comment: 'Normalized distance in yards',
    },
    elevation_correction: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      comment: 'MIL or MOA',
    },
    windage_correction: {
      type: DataTypes.DECIMAL(7, 4),
      allowNull: false,
      comment: 'MIL or MOA',
    },
    correction_unit: {
      type: DataTypes.ENUM('MIL', 'MOA'),
      allowNull: false,
    },
    target_type: {
      type: DataTypes.ENUM('steel', 'paper', 'vital_zone', 'other'),
      allowNull: false,
    },
    group_size: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
      comment: 'Inches',
    },
    hit_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    shot_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    hit_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      // Generated column in MySQL - calculated automatically
      comment: 'Hit percentage calculation',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'dope_logs',
    timestamps: false, // Uses custom timestamp field
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['rifle_id'] },
      { fields: ['ammo_id'] },
      { fields: ['timestamp'] },
      { fields: ['distance'] },
      { fields: ['distance_yards'] },
      { fields: ['rifle_id', 'distance_yards'] },
    ],
    validate: {
      hitCountValid() {
        if (
          this.hit_count !== null &&
          this.shot_count !== null &&
          this.hit_count > this.shot_count
        ) {
          throw new Error('Hit count cannot exceed shot count');
        }
      },
    },
    hooks: {
      beforeValidate: (log: DOPELog) => {
        // Calculate distance_yards from distance and unit
        if (!log.distance_yards) {
          log.distance_yards = DOPELog.convertToYards(log.distance, log.distance_unit);
        }
      },
    },
  }
);

// Define associations
DOPELog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

DOPELog.belongsTo(RifleProfile, {
  foreignKey: 'rifle_id',
  as: 'rifle',
});

DOPELog.belongsTo(AmmoProfile, {
  foreignKey: 'ammo_id',
  as: 'ammo',
});

DOPELog.belongsTo(EnvironmentSnapshot, {
  foreignKey: 'environment_id',
  as: 'environment',
});

export default DOPELog;
