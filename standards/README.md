# Mobile DOPE API - Development Standards

> **Project Architecture**: RESTful API for Mobile DOPE precision shooting application

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Development Environment](#development-environment)
- [Deployment](#deployment)
- [Documentation Navigation](#documentation-navigation)

## Project Overview

The Mobile DOPE API is a RESTful backend service that supports the Mobile DOPE mobile application (React Native). The API provides two primary functions:

### Primary Functions

1. **User Data Backup & Sync**
   - Secure cloud backup of rifle profiles, ammunition data, and DOPE logs
   - Cross-device synchronization for authenticated users
   - Data export/import functionality
   - User authentication and profile management

2. **Crowdsourced Ammunition Database**
   - Community-contributed ammunition profiles
   - Verified ballistic data from real-world testing
   - Manufacturer-specific load data
   - Rating and validation system for data quality
   - Search and filter capabilities for finding ammunition profiles

## Architecture

### Repository Structure

```
mobileDOPE/
├── app/                      # React Native mobile application
│   ├── src/                  # Mobile app source code
│   ├── __tests__/            # Mobile app tests
│   └── ...
│
├── api/                      # RESTful API backend
│   ├── standards/            # Development standards (this directory)
│   ├── src/                  # API source code (to be created)
│   ├── tests/                # API tests (to be created)
│   ├── docker/               # Docker configuration
│   └── ...
│
└── README.md                 # Project root documentation
```

### Technology Stack Overview

- **Runtime**: Node.js (Latest LTS)
- **Framework**: Express.js (RESTful API)
- **Language**: TypeScript (strict mode)
- **Database**: MySQL 9.x Innovation Release (9.1+)
- **ORM**: Sequelize
- **Authentication**: JWT (JSON Web Tokens)
- **Containerization**: Docker & Docker Compose
- **Deployment**: Digital Ocean App Platform
- **CI/CD**: GitHub Actions
- **Process Management**: PM2 (in production)

## Development Environment

### Prerequisites

- **Docker Desktop**: For containerized local development
- **Node.js**: Latest LTS version (for local tooling)
- **Git**: Version control

### Docker-Based Development

All development should be done using Docker containers to ensure consistency across development environments.

```bash
# Start development environment
cd api
docker-compose up

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop environment
docker-compose down

# Rebuild containers after dependency changes
docker-compose build --no-cache
docker-compose up
```

### Local Development (without Docker)

If Docker is not available, you can run locally:

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

## Deployment

### Target Platform

- **Platform**: Digital Ocean App Platform
- **Container-Based Deployment**: Docker images pushed to registry
- **Database**: Digital Ocean Managed MySQL Database
- **Environment**: Production, Staging, Development

### Deployment Strategy

1. **Containerization**: All code runs in Docker containers
2. **Database**: Digital Ocean managed MySQL (automatic backups, scaling)
3. **CI/CD Pipeline**: GitHub Actions for automated testing and deployment
4. **Environment Variables**: Managed through Digital Ocean App Platform
5. **Scaling**: Horizontal scaling via App Platform

See [deployment-procedures.md](./deployment-procedures.md) for detailed deployment documentation.

## Documentation Navigation

### Core Standards

- [📋 Global Rules](./global-rules.md) - Authentication, CORS, rate limiting, general API rules
- [🔧 Technologies](./technologies.md) - Technology stack, dependencies, and requirements
- [🏗️ Node.js Structure](./node_structure_and_naming_conventions.md) - File structure, naming conventions, coding standards
- [📊 SQL Standards](./sql-standards-and-patterns.md) - Database design patterns and SQL conventions

### API Design

- [🔌 Operations & Responses](./operations-and-responses.md) - HTTP methods, status codes, response formats
- [📨 Request Patterns](./request.md) - Request structure, headers, body formats
- [✅ Validation](./validation.md) - Input validation rules and patterns
- [🔐 Security](./SECURITY.md) - Security guidelines and best practices

### Development Patterns

- [🔄 API Versioning](./api-versioning-strategy.md) - Versioning strategy and migration
- [💾 Caching Strategies](./caching-strategies.md) - Caching patterns and implementation
- [📁 File Upload/Download](./file-upload-download-patterns.md) - File handling patterns
- [⚡ WebSocket & Real-time](./websocket-realtime-patterns.md) - WebSocket patterns for real-time features

### Operations

- [🚀 Deployment Procedures](./deployment-procedures.md) - Docker, Digital Ocean, CI/CD
- [📈 Monitoring & Alerting](./monitoring-and-alerting-standards.md) - Observability standards
- [🔬 Testing Standards](./testing-standards.md) - Unit, integration, and E2E testing
- [🔄 CI/CD Pipeline](./cicd-pipeline-requirements.md) - Automated build, test, and deploy

### Database

- [🗄️ MySQL 9 Migration Guide](./mysql-9-migration-guide.md) - Upgrading to MySQL 9
- [🧹 Clean SQL Script](./clean.sql) - Database cleanup utility

## Quick Start Guide

### For New Developers

1. **Review Core Standards First**
   - Read [global-rules.md](./global-rules.md)
   - Read [technologies.md](./technologies.md)
   - Read [node_structure_and_naming_conventions.md](./node_structure_and_naming_conventions.md)

2. **Set Up Development Environment**
   - Install Docker Desktop
   - Clone repository
   - Review [deployment-procedures.md](./deployment-procedures.md) for Docker setup

3. **Understand the Data Model**
   - Review mobile app data structures in `/app/src/models/`
   - Review [sql-standards-and-patterns.md](./sql-standards-and-patterns.md)
   - Plan API endpoints based on mobile app needs

4. **Follow Development Workflow**
   - Create feature branch
   - Develop in Docker container
   - Write tests (see [testing-standards.md](./testing-standards.md))
   - Submit pull request

## Integration with Mobile App

### Mobile App Tech Stack

The Mobile DOPE mobile app (`/app`) is built with:
- React Native with Expo SDK 54
- TypeScript (strict mode)
- SQLite for local storage
- Zustand for state management

### API Integration Points

The API must support the following mobile app features:

1. **User Authentication**
   - JWT-based authentication
   - Token refresh mechanism
   - Biometric authentication support

2. **Data Synchronization**
   - Rifle profiles (CRUD + sync)
   - Ammunition profiles (CRUD + sync)
   - DOPE logs (CRUD + sync)
   - Environmental data (read-only from community)

3. **Crowdsourced Data**
   - Browse ammunition profiles
   - Submit new ammunition profiles
   - Rate and validate community data
   - Search and filter ammunition database

4. **Export/Import**
   - JSON export/import for data portability
   - CSV export for DOPE logs
   - Backup restoration

## Contributing

All contributions must adhere to the standards documented in this directory. Key requirements:

- **Code Quality**: All code must pass TypeScript checks, ESLint, and Prettier
- **Testing**: Minimum 80% code coverage
- **Documentation**: JSDoc comments for all functions and classes
- **Security**: Follow [SECURITY.md](./SECURITY.md) guidelines
- **Performance**: API response time < 200ms average

## Support

For questions or issues:
- Review the relevant standards documentation
- Check existing GitHub issues
- Create a new issue with detailed information

---

**Last Updated**: November 2024
**Maintained By**: Development Team
