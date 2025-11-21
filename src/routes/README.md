# Routes

This directory contains Express route definitions.

## Planned Routes

### Authentication Routes (`/api/v1/auth`)
- `POST /register` - User registration
- `POST /login` - User login
- `POST /refresh` - Refresh access token
- `POST /logout` - User logout

### User Routes (`/api/v1/users`)
- `GET /me` - Get current user profile
- `PUT /me` - Update current user profile
- `DELETE /me` - Delete user account

### Rifle Profile Routes (`/api/v1/rifles`)
- `GET /` - List all rifle profiles
- `POST /` - Create rifle profile
- `GET /:id` - Get rifle profile by ID
- `PUT /:id` - Update rifle profile
- `DELETE /:id` - Delete rifle profile

### Ammunition Routes (`/api/v1/ammo`)
- `GET /` - List ammunition profiles
- `POST /` - Create ammunition profile
- `GET /:id` - Get ammunition profile by ID
- `PUT /:id` - Update ammunition profile
- `DELETE /:id` - Delete ammunition profile

### DOPE Log Routes (`/api/v1/logs`)
- `GET /` - List DOPE logs
- `POST /` - Create DOPE log
- `GET /:id` - Get DOPE log by ID
- `PUT /:id` - Update DOPE log
- `DELETE /:id` - Delete DOPE log
- `GET /export` - Export logs (CSV/JSON)

### Sync Routes (`/api/v1/sync`)
- `POST /` - Full data sync
- `POST /rifles` - Sync rifles
- `POST /ammo` - Sync ammunition
- `POST /logs` - Sync DOPE logs

### Community Ammunition Routes (`/api/v1/community/ammo`)
- `GET /` - Search community ammunition
- `POST /` - Submit ammunition data
- `GET /:id` - Get community ammunition by ID
- `POST /:id/vote` - Vote on data quality
- `POST /:id/validate` - Validate data (admin)

All routes should:
- Use proper HTTP methods
- Include authentication middleware
- Include validation middleware
- Return consistent response formats
- Handle errors appropriately
