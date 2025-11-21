# Controllers

This directory contains Express route controllers for the Mobile DOPE API.

## Planned Controllers

- `AuthController.ts` - User authentication (register, login, refresh token)
- `UserController.ts` - User profile management
- `RifleController.ts` - Rifle profile CRUD operations
- `AmmoController.ts` - Ammunition profile CRUD operations
- `DOPELogController.ts` - DOPE log CRUD operations
- `SyncController.ts` - Data synchronization endpoints
- `CommunityAmmoController.ts` - Crowdsourced ammunition database

Each controller should extend a base controller for consistent error handling and response formatting.
