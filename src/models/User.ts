import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';

/**
 * User Model
 *
 * Represents user accounts for authentication and authorization.
 * Includes JWT refresh tokens, email verification, and password reset functionality.
 */

interface UserAttributes {
  id: number;
  uuid: string; // Generated column
  email: string;
  password_hash: string;
  name?: string;
  is_active: boolean;
  is_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  password_reset_token?: string;
  password_reset_expires?: Date;
  last_login_at?: Date;
  login_count: number; // Invisible column
  row_version: number; // Invisible column
  created_at?: Date;
  updated_at?: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'uuid' | 'is_active' | 'is_verified' | 'login_count' | 'row_version' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public uuid!: string;
  public email!: string;
  public password_hash!: string;
  public name?: string;
  public is_active!: boolean;
  public is_verified!: boolean;
  public email_verification_token?: string;
  public email_verification_expires?: Date;
  public password_reset_token?: string;
  public password_reset_expires?: Date;
  public last_login_at?: Date;
  public login_count!: number;
  public row_version!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Hash password before saving
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  public async comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }

  /**
   * Update login information
   */
  public async recordLogin(): Promise<void> {
    this.last_login_at = new Date();
    this.login_count += 1;
    await this.save();
  }

  /**
   * Generate email verification token
   */
  public async generateVerificationToken(): Promise<string> {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.email_verification_token = token;
    this.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await this.save();
    return token;
  }

  /**
   * Generate password reset token
   */
  public async generatePasswordResetToken(): Promise<string> {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.password_reset_token = token;
    this.password_reset_expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
    await this.save();
    return token;
  }

  /**
   * Clear password reset token
   */
  public async clearPasswordResetToken(): Promise<void> {
    this.password_reset_token = undefined;
    this.password_reset_expires = undefined;
    await this.save();
  }

  /**
   * Get user JSON (exclude sensitive fields)
   */
  public toJSON(): Partial<UserAttributes> {
    const values = { ...this.get() };
    delete values.password_hash;
    delete values.email_verification_token;
    delete values.password_reset_token;
    delete values.login_count;
    delete values.row_version;
    return values;
  }
}

User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    uuid: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      // Generated column - calculated by database
      comment: 'UUID v4 generated from ID for external API use',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    email_verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email_verification_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    login_count: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      // Invisible column in MySQL
      comment: 'Track login frequency',
    },
    row_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      // Invisible column in MySQL
      comment: 'Optimistic locking',
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
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['uuid'] },
      { fields: ['email'], unique: true },
      { fields: ['email_verification_token'] },
      { fields: ['password_reset_token'] },
      { fields: ['is_active', 'is_verified'] },
    ],
    hooks: {
      beforeUpdate: (user: User) => {
        // Increment row_version for optimistic locking
        user.row_version += 1;
      },
    },
  }
);

export default User;
