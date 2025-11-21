# Models

This directory contains Sequelize models for database entities.

## Planned Models

Based on the mobile app's data structures:

- `User.ts` - User accounts and authentication
- `RifleProfile.ts` - Rifle configuration data
- `AmmoProfile.ts` - Ammunition specifications
- `DOPELog.ts` - DOPE (Data On Previous Engagements) records
- `EnvironmentSnapshot.ts` - Environmental conditions
- `CommunityAmmo.ts` - Crowdsourced ammunition data

All models should:
- Use UUIDs for primary keys
- Include timestamps (createdAt, updatedAt)
- Define proper associations
- Include validation rules
