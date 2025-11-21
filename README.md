# Mobile DOPE API

RESTful API backend for the Mobile DOPE precision shooting application.

## Overview

The Mobile DOPE API provides:

1. **User Data Backup & Sync** - Secure cloud backup of rifle profiles, ammunition data, and DOPE logs
2. **Crowdsourced Ammunition Database** - Community-contributed ammunition profiles with verified ballistic data

## Technology Stack

- **Runtime**: Node.js 22 (LTS)
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: MySQL 8.4
- **ORM**: Sequelize
- **Authentication**: JWT
- **Containerization**: Docker & Docker Compose
- **Deployment**: Digital Ocean App Platform

## Quick Start

### Prerequisites

- Docker Desktop installed
- Node.js 22+ (optional, for local development without Docker)
- Git

### Development with Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd api

# Copy environment variables
cp .env.example .env

# Start all services (API, MySQL, Redis, phpMyAdmin)
docker-compose up

# The API will be available at:
# - API: http://localhost:3000
# - phpMyAdmin: http://localhost:8080
# - MySQL: localhost:3306

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev

# The API will be available at http://localhost:3000
```

## Project Structure

```
api/
├── src/                      # Source code
│   ├── config/               # Configuration files
│   ├── controllers/          # Route controllers
│   ├── middlewares/          # Express middlewares
│   ├── models/               # Sequelize models
│   ├── routes/               # Route definitions
│   ├── services/             # Business logic
│   ├── utils/                # Utility functions
│   └── server.ts             # Entry point
├── tests/                    # Test files
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test fixtures
├── database/                 # Database files
│   └── init/                 # Initialization scripts
├── docker/                   # Docker configuration
├── standards/                # Development standards
├── .env.example              # Example environment variables
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Production Docker image
├── Dockerfile.dev            # Development Docker image
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript configuration
```

## Available Scripts

### Development

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run typecheck` - Run TypeScript type checking

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Database

- `npm run migrate` - Run database migrations
- `npm run migrate:undo` - Undo last migration
- `npm run seed` - Run database seeders

### Docker

- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers
- `npm run docker:build` - Rebuild Docker containers
- `npm run docker:logs` - View API logs

## Environment Variables

See `.env.example` for all available environment variables. Key variables:

- `NODE_ENV` - Environment (development, staging, production)
- `PORT` - API server port (default: 3000)
- `DB_HOST` - Database host
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret key for JWT tokens
- `CORS_ORIGIN` - Allowed CORS origins

## API Documentation

### Base URL

- Development: `http://localhost:3000/api`
- Production: `https://api.mobiledope.com/api` (coming soon)

### Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Endpoints

#### Authentication (`/v1/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/v1/auth/register` | Register new user | Public |
| POST | `/v1/auth/login` | Login user | Public |
| POST | `/v1/auth/refresh` | Refresh access token | Public |
| POST | `/v1/auth/verify-email` | Verify email with token | Public |
| POST | `/v1/auth/forgot-password` | Request password reset | Public |
| POST | `/v1/auth/reset-password` | Reset password | Public |
| POST | `/v1/auth/logout` | Logout user | Private |
| GET | `/v1/auth/me` | Get current user | Private |

#### Rifle Profiles (`/v1/rifles`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/v1/rifles` | List rifles | Private |
| GET | `/v1/rifles/:id` | Get rifle | Private |
| GET | `/v1/rifles/:id/stats` | Get rifle stats | Private |
| POST | `/v1/rifles` | Create rifle | Private |
| PUT | `/v1/rifles/:id` | Update rifle | Private |
| DELETE | `/v1/rifles/:id` | Delete rifle | Private |

**Query Parameters** (List):
- `page` (default: 1) - Page number
- `limit` (default: 10, max: 100) - Items per page
- `caliber` - Filter by caliber
- `search` - Search in name/caliber

#### Ammunition Profiles (`/v1/ammo`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/v1/ammo` | List ammo | Private |
| GET | `/v1/ammo/:id` | Get ammo | Private |
| GET | `/v1/ammo/:id/stats` | Get ammo stats | Private |
| POST | `/v1/ammo` | Create ammo | Private |
| PUT | `/v1/ammo/:id` | Update ammo | Private |
| DELETE | `/v1/ammo/:id` | Delete ammo | Private |

**Query Parameters** (List):
- `page` - Page number
- `limit` - Items per page
- `rifle_id` - Filter by rifle
- `manufacturer` - Filter by manufacturer
- `search` - Search in name/manufacturer/bullet_type

#### DOPE Logs (`/v1/dope`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/v1/dope` | List logs | Private |
| GET | `/v1/dope/:id` | Get log | Private |
| GET | `/v1/dope/card` | Get DOPE card | Private |
| POST | `/v1/dope` | Create log | Private |
| PUT | `/v1/dope/:id` | Update log | Private |
| DELETE | `/v1/dope/:id` | Delete log | Private |

**Query Parameters** (List):
- `page` - Page number
- `limit` - Items per page
- `rifle_id` - Filter by rifle
- `ammo_id` - Filter by ammo
- `distance_min` - Minimum distance (yards)
- `distance_max` - Maximum distance (yards)
- `target_type` - Filter by type (steel/paper/vital_zone/other)
- `sort` - Sort order (distance_asc/distance_desc/accuracy/date)

**Query Parameters** (DOPE Card):
- `rifle_id` (required) - Rifle ID
- `ammo_id` (required) - Ammo ID

### Example Requests

#### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shooter@example.com",
    "password": "SecurePass123",
    "name": "John Shooter"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "shooter@example.com",
    "password": "SecurePass123"
  }'
```

#### Create Rifle

```bash
curl -X POST http://localhost:3000/api/v1/rifles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Precision Rifle",
    "caliber": ".308 Win",
    "barrel_length": 24,
    "twist_rate": "1:10",
    "zero_distance": 100,
    "optic_manufacturer": "Vortex",
    "optic_model": "Razor HD Gen II",
    "reticle_type": "EBR-2C MRAD",
    "click_value_type": "MIL",
    "click_value": 0.1,
    "scope_height": 1.5
  }'
```

#### Get DOPE Card

```bash
curl -X GET "http://localhost:3000/api/v1/dope/card?rifle_id=1&ammo_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": {},
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

**Paginated:**
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  },
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ],
  "timestamp": "2025-01-21T10:00:00.000Z"
}
```

### HTTP Status Codes

- `200` - OK
- `201` - Created
- `204` - No Content (Delete)
- `400` - Bad Request (Validation Error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

Interactive API documentation: `http://localhost:3000/api` (coming soon)

## Development Standards

All development must follow the standards documented in `/standards`:

- [Development Standards Overview](./standards/README.md)
- [Global Rules](./standards/global-rules.md)
- [Node.js Structure](./standards/node_structure_and_naming_conventions.md)
- [TypeScript Standards](./standards/typescript-standards.md)
- [Testing Standards](./standards/testing-standards.md)
- [Deployment Procedures](./standards/deployment-procedures.md)

## Integration with Mobile App

The API integrates with the React Native mobile app located in `/app`. Key integration points:

1. **Authentication** - JWT-based authentication
2. **Data Sync** - Rifle profiles, ammunition data, DOPE logs
3. **Crowdsourced Data** - Community ammunition profiles
4. **Export/Import** - JSON and CSV data portability

## Deployment

### Digital Ocean App Platform

The API is deployed to Digital Ocean App Platform. See [deployment-procedures.md](./standards/deployment-procedures.md) for detailed instructions.

```bash
# Install Digital Ocean CLI
brew install doctl

# Authenticate
doctl auth init

# Deploy
doctl apps create --spec .do/app.yaml
```

## Contributing

1. Create a feature branch from `develop`
2. Follow the development standards
3. Write tests for new functionality
4. Ensure all tests pass and code quality checks pass
5. Submit a pull request

## Support

For issues or questions:
- Review [standards documentation](./standards/)
- Check existing GitHub issues
- Create a new issue with detailed information

## License

MIT
