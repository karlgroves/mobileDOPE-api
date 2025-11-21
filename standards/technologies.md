# Technology Requirements

## Table of Contents

- [Core Technologies](#core-technologies)
- [Main Dependencies](#main-dependencies)
  - [API & Server](#api--server)
  - [Authentication & Security](#authentication--security)
  - [Database & ORM](#database--orm)
  - [Logging & Debugging](#logging--debugging)
  - [File Operations](#file-operations)
  - [Utilities](#utilities)
  - [Email](#email)
  - [Payments](#payments)
  - [Process Management](#process-management)
  - [Code Formatting & Quality](#code-formatting--quality)
- [Development Dependencies](#development-dependencies)
  - [Testing](#testing)
  - [TypeScript](#typescript)
  - [Linting & Formatting](#linting--formatting)
  - [Build & Deployment](#build--deployment)
- [Coding Standards](#coding-standards)
- [Database Conventions](#database-conventions)
- [Security Requirements](#security-requirements)
- [Non-Functional Requirements](#non-functional-requirements)

## Core Technologies

- **Backend Framework**: Node.js with Express.js (RESTful API)
- **Language**: TypeScript with strict mode enabled
- **Database**: MySQL 8.4 LTS (supported until April 2032) with Sequelize ORM
  - **Note**: MySQL 9.0.0 should be avoided (use 9.0.1+)
  - **Recommended**: MySQL 8.4 LTS for production stability
  - **Deployment Database**: Digital Ocean Managed MySQL Database
- **Containerization**: Docker and Docker Compose
  - Development environment runs in Docker containers
  - Production deployment via Docker images
- **Deployment Platform**: Digital Ocean App Platform
  - Container-based deployment
  - Managed database service
  - Auto-scaling and load balancing
- **Reverse Proxy**: Nginx (configured in Docker)
- **Process Management**: PM2 (in production containers)
- **CI/CD**: GitHub Actions for automated build, test, and deploy tasks
- **Package Management**: NPM with Semantic Versioning
- **Node Version**: Latest LTS version (specified in .nvmrc)

## Main Dependencies

### API & Server

- **Express**: Web framework for Node.js
- **express-rate-limit**: Rate limiting middleware
- **express-validator**: Input validation middleware
- **express-jwt**: JWT authorization middleware
- **body-parser**: Request body parsing middleware
- **cookie-parser**: Cookie parsing middleware
- **cors**: Cross-Origin Resource Sharing middleware
- **helmet**: Security headers middleware
- **serve-favicon**: Favicon serving middleware
- **dotenv**: Environment variable management
- **path**: Utilities for working with file paths

### Authentication & Security

- **jsonwebtoken**: JWT implementation
- **bcrypt**: Password hashing
- **crypto-js**: Cryptographic functions
- **xss**: Cross-site scripting protection

### Database & ORM

- **sequelize**: ORM for MySQL/MariaDB
- **mysql2**: MySQL client for Node.js
- **uuid**: UUID generation for database IDs

### Logging & Debugging

- **bunyan**: Primary logging framework - provides structured logging with multiple transports
- **debug**: Debug utility for development debugging
- **morgan**: HTTP request logger middleware for Express

### File Operations

- **multer**: File upload handling
- **multer-s3**: S3 storage for Multer
- **graceful-fs**: Improved file system operations
- **mkdirp**: Recursive directory creation
- **ncp**: File copying utility

### Utilities

- **moment**: Date manipulation
- **lodash**: Utility library
- **i18n**: Internationalization
- **node-cache**: In-memory caching
- **bun**: JavaScript runtime and package manager
- **esm**: ECMAScript module loader
- **reflect-metadata**: Metadata reflection API

### Email

- **nodemailer**: Email sending
- **nodemailer-express-handlebars**: Email templates with Handlebars

### Payments

- **stripe**: Payment processing
- **outseta**: User and subscription management

### Process Management

- **pm2**: Node.js process manager

### Code Formatting & Quality

- **js-beautify**: Code formatting
- **prettier**: Code formatting

## Development Dependencies

### Testing

- **jest**: Testing framework
- **supertest**: HTTP testing
- **ts-jest**: TypeScript support for Jest
- **sequelize-mock**: Mocking for Sequelize
- **istanbul-lib-coverage**: Code coverage
- **nyc**: Istanbul CLI

### TypeScript

- **typescript**: TypeScript compiler
- **ts-node**: TypeScript execution
- **typedoc**: Documentation generator
- **typedoc-plugin-markdown**: Markdown output for TypeDoc

### Linting & Formatting

- **eslint**: JavaScript linter
- **husky**: Git hooks
- **lint-staged**: Staged files linting
- **markdownlint**: Markdown linter
- **markdownlint-cli**: CLI for markdownlint

### Build & Deployment

- **cross-env**: Cross-platform environment variables
- **dotenv-cli**: CLI for dotenv
- **node-gyp**: Native addon build tool
- **serverless**: Serverless framework
- **serverless-http**: HTTP adapter for serverless
- **serverless-offline**: Local serverless development
- **serverless-plugin-typescript**: TypeScript support for serverless
- **serverless-plugin-warmup**: Lambda function warming
- **serverless-scriptable-plugin**: Custom scripts in serverless

## Coding Standards

- **Imports**: Group by type (npm packages first, then local files)
- **Formatting**: Use consistent indentation (2 spaces)
- **Error Handling**: Always use try/catch and log errors with the logger
- **Controllers**: Extend baseController for consistent CRUD operations
- **Validation**: Use Joi schemas in validationMiddleware.js
- **Naming**: camelCase for variables/functions, PascalCase for classes/models
- **Testing**: Each model/controller should have corresponding tests
- **i18n**: All user-facing messages should use i18n (req.\_\_()) for localization
- **Logging**: Use the log utility for consistent logging (info/warn/error/debug)
- **Routes**: Follow RESTful conventions with proper endpoint names

## Database Conventions

- **ORM**: Sequelize with MySQL/MariaDB
- **IDs**: Use UUIDs for all primary keys
- **Schema**: Follow established schema patterns (see sql-design-patterns.md)

## Security Requirements

- Follow [security best practices for Express](https://expressjs.com/en/advanced/best-practice-security.html)
- Implement proper authentication using JWT
- Validate all inputs using express-validator
- Protect against XSS attacks using the xss package
- Set security headers using helmet

## Non-Functional Requirements

- **Scalability**: Support up to 1000 concurrent users
- **Performance**: Average API response time < 200ms
- **Maintainability**: Modular and clean code
- **Code Coverage**: Measure with Istanbul
