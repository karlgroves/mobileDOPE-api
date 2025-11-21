/**
 * Models Index
 *
 * Central export point for all Sequelize models.
 * Ensures proper initialization order and association setup.
 */

import sequelize from '../config/database';

// Import models in dependency order
import User from './User';
import RifleProfile from './RifleProfile';
import AmmoProfile from './AmmoProfile';
import EnvironmentSnapshot from './EnvironmentSnapshot';
import DOPELog from './DOPELog';

// Define associations
// Note: Individual model files already define belongsTo associations
// Here we define the hasMany inverse relationships

User.hasMany(RifleProfile, {
  foreignKey: 'user_id',
  as: 'rifle_profiles',
});

User.hasMany(AmmoProfile, {
  foreignKey: 'user_id',
  as: 'ammo_profiles',
});

User.hasMany(EnvironmentSnapshot, {
  foreignKey: 'user_id',
  as: 'environment_snapshots',
});

User.hasMany(DOPELog, {
  foreignKey: 'user_id',
  as: 'dope_logs',
});

RifleProfile.hasMany(AmmoProfile, {
  foreignKey: 'rifle_id',
  as: 'ammo_profiles',
});

RifleProfile.hasMany(DOPELog, {
  foreignKey: 'rifle_id',
  as: 'dope_logs',
});

AmmoProfile.hasMany(DOPELog, {
  foreignKey: 'ammo_id',
  as: 'dope_logs',
});

EnvironmentSnapshot.hasMany(DOPELog, {
  foreignKey: 'environment_id',
  as: 'dope_logs',
});

// Export models and sequelize instance
export {
  sequelize,
  User,
  RifleProfile,
  AmmoProfile,
  EnvironmentSnapshot,
  DOPELog,
};

// Export default object with all models
export default {
  sequelize,
  User,
  RifleProfile,
  AmmoProfile,
  EnvironmentSnapshot,
  DOPELog,
};
