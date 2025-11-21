import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

/**
 * EnvironmentSnapshot Model
 *
 * Stores environmental conditions at time of shooting.
 * Includes temperature, humidity, pressure, altitude, wind, and GPS coordinates.
 */

interface EnvironmentSnapshotAttributes {
  id: number;
  user_id: number;
  temperature: number; // Fahrenheit
  humidity: number; // percentage 0-100
  pressure: number; // inches of mercury (inHg)
  altitude: number; // feet
  density_altitude: number; // feet (calculated)
  wind_speed: number; // miles per hour
  wind_direction: number; // degrees 0-360
  latitude?: number;
  longitude?: number;
  timestamp?: Date;
}

interface EnvironmentSnapshotCreationAttributes extends Optional<EnvironmentSnapshotAttributes, 'id' | 'timestamp'> {}

class EnvironmentSnapshot extends Model<EnvironmentSnapshotAttributes, EnvironmentSnapshotCreationAttributes> implements EnvironmentSnapshotAttributes {
  public id!: number;
  public user_id!: number;
  public temperature!: number;
  public humidity!: number;
  public pressure!: number;
  public altitude!: number;
  public density_altitude!: number;
  public wind_speed!: number;
  public wind_direction!: number;
  public latitude?: number;
  public longitude?: number;
  public readonly timestamp!: Date;

  // Associations
  public readonly user?: User;

  public static associations: {
    user: Association<EnvironmentSnapshot, User>;
  };

  /**
   * Calculate density altitude from environmental conditions
   * Formula: DA = PA + (120 * (OAT - ISA))
   * Where: PA = Pressure Altitude, OAT = Outside Air Temp, ISA = Standard Temp
   */
  public static calculateDensityAltitude(
    temperature: number,
    pressure: number,
    altitude: number
  ): number {
    const standardPressure = 29.92; // inHg at sea level
    const pressureAltitude = altitude + 1000 * (standardPressure - pressure);
    const standardTemp = 59 - 0.00356 * altitude; // ISA temp at altitude
    const tempDifference = temperature - standardTemp;
    const densityAltitude = pressureAltitude + 120 * tempDifference;
    return Math.round(densityAltitude);
  }

  /**
   * Get wind direction as compass bearing
   */
  public getWindBearing(): string {
    const bearings = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(this.wind_direction / 22.5) % 16;
    return bearings[index];
  }

  /**
   * Get environment summary
   */
  public getSummary(): string {
    return `${this.temperature}°F, ${this.humidity}% RH, ${this.pressure}" Hg, DA: ${this.density_altitude}ft, Wind: ${this.wind_speed}mph @ ${this.getWindBearing()}`;
  }
}

EnvironmentSnapshot.init(
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
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: -50,
        max: 150,
      },
      comment: 'Fahrenheit',
    },
    humidity: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Percentage 0-100',
    },
    pressure: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 20,
        max: 35,
      },
      comment: 'Inches of mercury (inHg)',
    },
    altitude: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      validate: {
        min: -1000,
        max: 30000,
      },
      comment: 'Feet',
    },
    density_altitude: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      comment: 'Feet (calculated)',
    },
    wind_speed: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
      comment: 'Miles per hour',
    },
    wind_direction: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 359.99,
      },
      comment: 'Degrees 0-360',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180,
      },
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'environment_snapshots',
    timestamps: false, // Uses custom timestamp field
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['timestamp'] },
    ],
    hooks: {
      beforeValidate: (snapshot: EnvironmentSnapshot) => {
        // Auto-calculate density altitude if not provided
        if (!snapshot.density_altitude) {
          snapshot.density_altitude = EnvironmentSnapshot.calculateDensityAltitude(
            snapshot.temperature,
            snapshot.pressure,
            snapshot.altitude
          );
        }
      },
    },
  }
);

// Define associations
EnvironmentSnapshot.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

export default EnvironmentSnapshot;
