import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import RifleProfile from './RifleProfile';

/**
 * AmmoProfile Model
 *
 * Stores ammunition specifications linked to rifle profiles.
 * Includes ballistic coefficients, velocities, and load data.
 */

interface AmmoProfileAttributes {
  id: number;
  user_id: number;
  rifle_id: number;
  name: string;
  manufacturer: string;
  bullet_weight: number; // grains
  bullet_type: string; // HPBT, ELD-X, etc.
  ballistic_coefficient_g1: number;
  ballistic_coefficient_g7: number;
  muzzle_velocity: number; // feet per second
  powder_type?: string;
  powder_weight?: number; // grains
  lot_number?: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface AmmoProfileCreationAttributes extends Optional<AmmoProfileAttributes, 'id' | 'created_at' | 'updated_at'> {}

class AmmoProfile extends Model<AmmoProfileAttributes, AmmoProfileCreationAttributes> implements AmmoProfileAttributes {
  public id!: number;
  public user_id!: number;
  public rifle_id!: number;
  public name!: string;
  public manufacturer!: string;
  public bullet_weight!: number;
  public bullet_type!: string;
  public ballistic_coefficient_g1!: number;
  public ballistic_coefficient_g7!: number;
  public muzzle_velocity!: number;
  public powder_type?: string;
  public powder_weight?: number;
  public lot_number?: string;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public readonly user?: User;
  public readonly rifle?: RifleProfile;

  public static associations: {
    user: Association<AmmoProfile, User>;
    rifle: Association<AmmoProfile, RifleProfile>;
  };

  /**
   * Get ammo summary
   */
  public getSummary(): string {
    return `${this.manufacturer} ${this.name} - ${this.bullet_weight}gr ${this.bullet_type}`;
  }

  /**
   * Calculate kinetic energy at muzzle
   * Formula: KE = (mass * velocity^2) / 450240
   * Returns energy in foot-pounds
   */
  public getMuzzleEnergy(): number {
    return (this.bullet_weight * Math.pow(this.muzzle_velocity, 2)) / 450240;
  }

  /**
   * Get sectional density
   * Formula: SD = weight (grains) / (diameter^2 * 7000)
   * Note: Caliber to diameter conversion needed for accurate calculation
   */
  public getSectionalDensity(bulletDiameter: number): number {
    return this.bullet_weight / (Math.pow(bulletDiameter, 2) * 7000);
  }
}

AmmoProfile.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    manufacturer: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    bullet_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 1000,
      },
      comment: 'Grains',
    },
    bullet_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
      comment: 'HPBT, ELD-X, etc.',
    },
    ballistic_coefficient_g1: {
      type: DataTypes.DECIMAL(6, 4),
      allowNull: false,
      validate: {
        min: 0,
        max: 1,
      },
    },
    ballistic_coefficient_g7: {
      type: DataTypes.DECIMAL(6, 4),
      allowNull: false,
      validate: {
        min: 0,
        max: 1,
      },
    },
    muzzle_velocity: {
      type: DataTypes.DECIMAL(7, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 5000,
      },
      comment: 'Feet per second',
    },
    powder_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    powder_weight: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
      comment: 'Grains',
    },
    lot_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ammo_profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['rifle_id'] },
      { fields: ['manufacturer'] },
    ],
  }
);

// Define associations
AmmoProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

AmmoProfile.belongsTo(RifleProfile, {
  foreignKey: 'rifle_id',
  as: 'rifle',
});

export default AmmoProfile;
