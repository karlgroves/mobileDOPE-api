import { DataTypes, Model, Optional, Association } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

/**
 * RifleProfile Model
 *
 * Stores rifle configuration data including optics, barrel specifications,
 * and ballistic settings.
 */

interface RifleProfileAttributes {
  id: number;
  user_id: number;
  name: string;
  caliber: string;
  barrel_length: number; // inches
  twist_rate: string; // format: "1:8", "1:10"
  zero_distance: number; // yards
  optic_manufacturer: string;
  optic_model: string;
  reticle_type: string;
  click_value_type: 'MIL' | 'MOA';
  click_value: number; // value per click
  scope_height: number; // inches over bore
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface RifleProfileCreationAttributes extends Optional<RifleProfileAttributes, 'id' | 'created_at' | 'updated_at'> {}

class RifleProfile extends Model<RifleProfileAttributes, RifleProfileCreationAttributes> implements RifleProfileAttributes {
  public id!: number;
  public user_id!: number;
  public name!: string;
  public caliber!: string;
  public barrel_length!: number;
  public twist_rate!: string;
  public zero_distance!: number;
  public optic_manufacturer!: string;
  public optic_model!: string;
  public reticle_type!: string;
  public click_value_type!: 'MIL' | 'MOA';
  public click_value!: number;
  public scope_height!: number;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public readonly user?: User;

  public static associations: {
    user: Association<RifleProfile, User>;
  };

  /**
   * Validate twist rate format
   */
  public static isValidTwistRate(twistRate: string): boolean {
    return /^1:\d+$/.test(twistRate);
  }

  /**
   * Get rifle summary
   */
  public getSummary(): string {
    return `${this.name} - ${this.caliber} (${this.barrel_length}" barrel, ${this.twist_rate} twist)`;
  }
}

RifleProfile.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    caliber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    barrel_length: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 50,
      },
      comment: 'Inches',
    },
    twist_rate: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        is: /^1:\d+$/,
      },
      comment: 'Format: 1:8, 1:10, etc.',
    },
    zero_distance: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 1000,
      },
      comment: 'Yards',
    },
    optic_manufacturer: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    optic_model: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    reticle_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    click_value_type: {
      type: DataTypes.ENUM('MIL', 'MOA'),
      allowNull: false,
    },
    click_value: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      validate: {
        min: 0,
        max: 1,
      },
      comment: 'Value per click',
    },
    scope_height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 10,
      },
      comment: 'Inches over bore',
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
    tableName: 'rifle_profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['caliber'] },
    ],
  }
);

// Define associations
RifleProfile.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

export default RifleProfile;
