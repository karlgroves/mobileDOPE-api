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

API documentation will be available at:
- Development: http://localhost:3000/api-docs
- Production: https://api.mobiledope.com/api-docs

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
