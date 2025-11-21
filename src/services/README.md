# Services

This directory contains business logic services.

## Planned Services

- `AuthService.ts` - Authentication logic (password hashing, token generation)
- `UserService.ts` - User management logic
- `RifleService.ts` - Rifle profile business logic
- `AmmoService.ts` - Ammunition profile business logic
- `DOPELogService.ts` - DOPE log business logic
- `SyncService.ts` - Data synchronization logic
- `ValidationService.ts` - Data validation logic
- `ExportService.ts` - Data export (CSV, JSON)

Services should:
- Contain business logic separated from controllers
- Be unit testable
- Return results or throw custom errors
- Not depend on Express request/response objects
