# Deployment Procedures Guide

This document provides comprehensive deployment procedures for the Mobile DOPE API, with a focus on
Docker-based development and Digital Ocean App Platform deployment.

## Table of Contents

- [Overview](#overview)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Configuration](#environment-configuration)
- [Deployment Strategies](#deployment-strategies)
- [Platform-Specific Deployments](#platform-specific-deployments)
- [Container Deployments](#container-deployments)
- [Database Migrations](#database-migrations)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Rollback Procedures](#rollback-procedures)
- [Security Considerations](#security-considerations)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Overview

### Mobile DOPE API Deployment Strategy

The Mobile DOPE API uses a container-first deployment approach with Docker and Digital Ocean:

- **Local Development**: Docker Compose for consistent development environment
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Production Platform**: Digital Ocean App Platform with managed MySQL
- **Container Registry**: Digital Ocean Container Registry (DOCR)
- **Database**: Digital Ocean Managed MySQL Database (automatic backups, scaling)

### Deployment Environments

The Mobile DOPE API deploys to these environments:

1. **Development** - Local development with Docker Compose
2. **Staging** - Digital Ocean staging environment for pre-production testing
3. **Production** - Digital Ocean production environment for live users
4. **CI/CD** - Automated testing in GitHub Actions containers

### Deployment Pipeline

```text
Code Commit → CI/CD Pipeline → Testing → Staging → Production
     ↓             ↓            ↓          ↓           ↓
  Linting      Unit Tests   Integration  User      Performance
  Type Check   E2E Tests    Tests        Testing   Monitoring
```

## Pre-Deployment Checklist

### Code Quality Verification

- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Security scan passes (`npm audit`)
- [ ] Code coverage meets minimum threshold (80%)

### Dependencies and Configuration

- [ ] Dependencies are up to date and audited
- [ ] Environment variables are configured
- [ ] Configuration files are validated
- [ ] Secrets are properly managed
- [ ] Database migrations are ready

### Documentation and Validation

- [ ] API documentation is updated
- [ ] Changelog is updated
- [ ] Version number is bumped
- [ ] README is current
- [ ] Deployment notes are prepared

## Environment Configuration

### Environment Variables

Create environment-specific `.env` files:

```bash
# Production (.env.production)
NODE_ENV=production
PORT=3000
DB_HOST=prod-db.example.com
DB_PORT=3306
DB_NAME=myapp_prod
DB_USER=app_user
DB_PASSWORD=${SECRET_DB_PASSWORD}
REDIS_URL=redis://prod-redis.example.com:6379
JWT_SECRET=${SECRET_JWT_KEY}
API_KEY=${SECRET_API_KEY}
LOG_LEVEL=info
CORS_ORIGIN=https://myapp.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

```bash
# Staging (.env.staging)
NODE_ENV=staging
PORT=3000
DB_HOST=staging-db.example.com
DB_PORT=3306
DB_NAME=myapp_staging
DB_USER=app_user
DB_PASSWORD=${SECRET_DB_PASSWORD_STAGING}
REDIS_URL=redis://staging-redis.example.com:6379
JWT_SECRET=${SECRET_JWT_KEY_STAGING}
LOG_LEVEL=debug
CORS_ORIGIN=https://staging.myapp.com
```

### Configuration Management

Use a configuration management system:

```javascript
// config/index.js
const config = {
  development: {
    port: 3000,
    database: {
      host: "localhost",
      port: 3306,
      name: "myapp_dev",
    },
  },
  staging: {
    port: process.env.PORT || 3000,
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      name: process.env.DB_NAME,
    },
  },
  production: {
    port: process.env.PORT || 3000,
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      name: process.env.DB_NAME,
    },
    cache: {
      ttl: 3600,
      maxSize: 1000,
    },
  },
};

module.exports = config[process.env.NODE_ENV || "development"];
```

## Deployment Strategies

### 1. Blue-Green Deployment

Maintain two identical production environments:

```bash
# Deploy to green environment
kubectl apply -f k8s/green-deployment.yaml

# Test green environment
curl https://green.myapp.com/health

# Switch traffic to green
kubectl patch service myapp-service -p '{"spec":{"selector":{"version":"green"}}}'

# Verify deployment
kubectl get pods -l version=green

# Keep blue as rollback option
```

### 2. Rolling Deployment

Gradually replace instances:

```bash
# Update deployment with rolling strategy
kubectl set image deployment/myapp-deployment app=myapp:v2.1.0

# Monitor rollout
kubectl rollout status deployment/myapp-deployment

# Verify all pods are updated
kubectl get pods -l app=myapp
```

### 3. Canary Deployment

Deploy to subset of users:

```bash
# Deploy canary version (10% traffic)
kubectl apply -f k8s/canary-deployment.yaml

# Monitor metrics for canary
kubectl logs -l version=canary

# Gradually increase traffic
kubectl patch virtualservice myapp-vs --type='merge' \
  -p='{"spec":{"http":[{"match":[{"headers":{"canary":{"exact":"true"}}}],"route":[{"destination":{"host":"myapp","subset":"canary"}}]},{"route":[{"destination":{"host":"myapp","subset":"stable"},"weight":90},{"destination":{"host":"myapp","subset":"canary"},"weight":10}]}]}}'

# Full rollout if successful
kubectl apply -f k8s/production-deployment.yaml
```

## Platform-Specific Deployments

### Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create application
heroku create myapp-prod

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DB_URL=${DATABASE_URL}

# Add buildpacks
heroku buildpacks:add heroku/nodejs

# Deploy
git push heroku main

# Scale dynos
heroku ps:scale web=2

# Check logs
heroku logs --tail
```

### AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init myapp --region us-east-1

# Create environment
eb create production --instance-type t3.medium

# Deploy
eb deploy

# Set environment variables
eb setenv NODE_ENV=production DB_HOST=prod-db.us-east-1.rds.amazonaws.com

# Monitor
eb health
eb logs
```

### Digital Ocean App Platform (Primary Deployment)

The Mobile DOPE API uses Digital Ocean App Platform for production deployment. This platform provides:

- **Managed Infrastructure**: Automatic scaling, load balancing, and SSL/TLS
- **Container-Based Deployment**: Deploy from Docker images or Dockerfile
- **Managed Database**: MySQL 8.4 with automatic backups and failover
- **Environment Variables**: Secure secret management
- **GitHub Integration**: Automatic deployments on push to main/develop

#### App Platform Configuration

Create a `.do/app.yaml` file in the API directory:

```yaml
# .do/app.yaml - Mobile DOPE API Configuration
name: mobile-dope-api
region: nyc

# Database Configuration (Digital Ocean Managed MySQL)
databases:
  - name: mobile-dope-db
    engine: MYSQL
    version: "8"
    size: db-s-1vcpu-1gb
    num_nodes: 1
    production: true

# API Service
services:
  - name: api
    # Use Dockerfile for deployment
    dockerfile_path: api/Dockerfile
    source_dir: /api
    github:
      repo: your-org/mobileDOPE
      branch: main
      deploy_on_push: true

    # Runtime configuration
    instance_count: 2
    instance_size_slug: professional-xs  # 1 vCPU, 1 GB RAM

    # Environment variables
    envs:
      - key: NODE_ENV
        value: production

      - key: PORT
        value: "3000"

      - key: DB_HOST
        value: ${mobile-dope-db.HOSTNAME}
        type: SECRET

      - key: DB_PORT
        value: ${mobile-dope-db.PORT}

      - key: DB_NAME
        value: ${mobile-dope-db.DATABASE}

      - key: DB_USER
        value: ${mobile-dope-db.USERNAME}
        type: SECRET

      - key: DB_PASSWORD
        value: ${mobile-dope-db.PASSWORD}
        type: SECRET

      - key: JWT_SECRET
        type: SECRET
        value: ${JWT_SECRET}

      - key: CORS_ORIGIN
        value: "https://app.mobiledope.com"

      - key: RATE_LIMIT_WINDOW_MS
        value: "900000"

      - key: RATE_LIMIT_MAX_REQUESTS
        value: "100"

    # Health checks
    health_check:
      http_path: /health
      initial_delay_seconds: 30
      period_seconds: 10
      timeout_seconds: 3
      success_threshold: 1
      failure_threshold: 3

    # Auto-scaling
    autoscaling:
      min_instance_count: 1
      max_instance_count: 5
      metrics:
        cpu:
          percent: 80

# Static assets (if needed)
static_sites:
  - name: api-docs
    source_dir: /api/docs
    github:
      repo: your-org/mobileDOPE
      branch: main
    output_dir: /
```

#### Deployment Commands

```bash
# Install Digital Ocean CLI
brew install doctl  # macOS
# or
snap install doctl  # Linux

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Get app ID
doctl apps list

# Update existing app
doctl apps update YOUR_APP_ID --spec .do/app.yaml

# View app logs
doctl apps logs YOUR_APP_ID --type run

# View deployments
doctl apps list-deployments YOUR_APP_ID

# Trigger manual deployment
doctl apps create-deployment YOUR_APP_ID
```

#### Database Setup

```bash
# Create managed MySQL database
doctl databases create mobile-dope-db \
  --engine mysql \
  --version 8 \
  --region nyc3 \
  --size db-s-1vcpu-1gb \
  --num-nodes 1

# Get database connection details
doctl databases get mobile-dope-db

# Create database user
doctl databases user create mobile-dope-db api-user

# Get connection string
doctl databases connection mobile-dope-db

# Configure firewall (allow only your app)
doctl databases firewalls append mobile-dope-db \
  --rule app:YOUR_APP_ID
```

#### Container Registry Setup

```bash
# Create container registry
doctl registry create mobile-dope-registry

# Login to registry
doctl registry login

# Build and tag image
docker build -t registry.digitalocean.com/mobile-dope-registry/api:latest ./api

# Push to registry
docker push registry.digitalocean.com/mobile-dope-registry/api:latest

# Update app to use registry image
doctl apps update YOUR_APP_ID \
  --spec .do/app-with-registry.yaml
```

### Google Cloud Platform

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Initialize gcloud
gcloud init

# Deploy to App Engine
gcloud app deploy app.yaml

# Deploy to Cloud Run
gcloud run deploy myapp \
  --image gcr.io/PROJECT_ID/myapp:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Set environment variables
gcloud run services update myapp \
  --set-env-vars NODE_ENV=production,DB_HOST=10.0.0.1
```

## Container Deployments

### Docker Setup for Mobile DOPE API

#### Production Dockerfile

Create this `Dockerfile` in the `/api` directory:

```dockerfile
# Multi-stage build for Mobile DOPE API
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001 -G nodejs

# Change ownership
RUN chown -R app:nodejs /app
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

#### Development Dockerfile

Create this `Dockerfile.dev` for local development with hot-reload:

```dockerfile
FROM node:22-alpine

# Install development tools
RUN apk add --no-cache curl git

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Expose port
EXPOSE 3000

# Start development server with nodemon
CMD ["npm", "run", "dev"]
```

### Docker Compose for Mobile DOPE API

#### Development Environment (`docker-compose.yml`)

Create this in the `/api` directory for local development:

```yaml
# docker-compose.yml - Development environment for Mobile DOPE API
version: '3.8'

services:
  # API Service (development with hot-reload)
  api:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: mobile-dope-api-dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DB_HOST=db
      - DB_PORT=3306
      - DB_NAME=mobile_dope_dev
      - DB_USER=api_user
      - DB_PASSWORD=dev_password_changeme
      - JWT_SECRET=dev_jwt_secret_changeme_in_production
      - CORS_ORIGIN=http://localhost:3001,exp://192.168.1.100:8081
      - LOG_LEVEL=debug
      - RATE_LIMIT_WINDOW_MS=900000
      - RATE_LIMIT_MAX_REQUESTS=1000
    volumes:
      # Mount source code for hot-reload
      - ./src:/app/src
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
      # Prevent node_modules from being mounted
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy
    networks:
      - mobile-dope-network
    command: npm run dev

  # MySQL Database
  db:
    image: mysql:8.4
    container_name: mobile-dope-db-dev
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=root_password_changeme
      - MYSQL_DATABASE=mobile_dope_dev
      - MYSQL_USER=api_user
      - MYSQL_PASSWORD=dev_password_changeme
      - MYSQL_ROOT_HOST=%
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-proot_password_changeme"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - mobile-dope-network

  # phpMyAdmin (optional, for database management)
  phpmyadmin:
    image: phpmyadmin:latest
    container_name: mobile-dope-phpmyadmin
    ports:
      - "8080:80"
    environment:
      - PMA_HOST=db
      - PMA_PORT=3306
      - PMA_USER=root
      - PMA_PASSWORD=root_password_changeme
    depends_on:
      - db
    networks:
      - mobile-dope-network

  # Redis (for caching and session storage)
  redis:
    image: redis:7-alpine
    container_name: mobile-dope-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - mobile-dope-network

  # Nginx (reverse proxy, optional for local dev)
  nginx:
    image: nginx:alpine
    container_name: mobile-dope-nginx-dev
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    networks:
      - mobile-dope-network

volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local

networks:
  mobile-dope-network:
    driver: bridge
```

#### Production Environment (`docker-compose.prod.yml`)

```yaml
# docker-compose.prod.yml - Production-like local testing
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: mobile-dope-api-prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DB_HOST=db
      - DB_PORT=3306
      - DB_NAME=mobile_dope_prod
      - DB_USER=api_user
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
      - LOG_LEVEL=info
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - mobile-dope-network

  db:
    image: mysql:8.4
    container_name: mobile-dope-db-prod
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=mobile_dope_prod
      - MYSQL_USER=api_user
      - MYSQL_PASSWORD=${DB_PASSWORD}
    volumes:
      - mysql_prod_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - mobile-dope-network

  redis:
    image: redis:7-alpine
    container_name: mobile-dope-redis-prod
    volumes:
      - redis_prod_data:/data
    restart: unless-stopped
    networks:
      - mobile-dope-network

  nginx:
    image: nginx:alpine
    container_name: mobile-dope-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - mobile-dope-network

volumes:
  mysql_prod_data:
  redis_prod_data:

networks:
  mobile-dope-network:
    driver: bridge
```

#### Common Docker Commands

```bash
# Development workflow
cd api

# Start development environment
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f api

# Rebuild after dependency changes
docker-compose build
docker-compose up

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Access database CLI
docker-compose exec db mysql -u api_user -p mobile_dope_dev

# Access API container shell
docker-compose exec api sh

# Run migrations
docker-compose exec api npm run migrate

# Run tests
docker-compose exec api npm test

# Production-like testing
docker-compose -f docker-compose.prod.yml up
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-deployment
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      * name: app
        image: myapp:latest
        ports:
        * containerPort: 3000
        env:
        * name: NODE_ENV
          value: "production"
        * name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: db-host
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp
  ports:
  * protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Database Migrations

### Migration Strategy

```javascript
// migrations/001_initial_schema.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("users");
  },
};
```

### Pre-Deployment Migration Script

```bash
#!/bin/bash
# scripts/deploy-migrate.sh

set -e

echo "Starting database migration..."

# Backup current database
mysqldump --host=$DB_HOST --user=$DB_USER --password=$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run migrate:latest

# Verify migration
npm run migrate:status

echo "Migration completed successfully"
```

### Safe Migration Practices

1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use transactions for complex changes**
4. **Plan rollback migrations**
5. **Monitor performance impact**

```javascript
// Safe migration example
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Use transaction for multiple operations
    await queryInterface.sequelize.transaction(async (t) => {
      // Add column with default value first
      await queryInterface.addColumn(
        "users",
        "status",
        {
          type: Sequelize.STRING,
          defaultValue: "active",
        },
        { transaction: t },
      );

      // Populate new column
      await queryInterface.sequelize.query(
        "UPDATE users SET status = 'active'",
        { transaction: t },
      );

      // Make column non-nullable
      await queryInterface.changeColumn(
        "users",
        "status",
        {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: "active",
        },
        { transaction: t },
      );
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("users", "status");
  },
};
```

## Monitoring and Health Checks

### Health Check Endpoints

```javascript
// routes/health.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const redis = require("../redis");

// Basic health check
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

// Detailed health check
router.get("/health/detailed", async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalServices(),
  ]);

  const results = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    checks: {
      database: checks[0].status === "fulfilled" ? "healthy" : "unhealthy",
      redis: checks[1].status === "fulfilled" ? "healthy" : "unhealthy",
      external: checks[2].status === "fulfilled" ? "healthy" : "unhealthy",
    },
  };

  const isHealthy = Object.values(results.checks).every(
    (status) => status === "healthy",
  );
  results.status = isHealthy ? "healthy" : "unhealthy";

  res.status(isHealthy ? 200 : 503).json(results);
});

async function checkDatabase() {
  const result = await db.query("SELECT 1 as result");
  return result[0][0].result === 1;
}

async function checkRedis() {
  await redis.ping();
  return true;
}

async function checkExternalServices() {
  // Check external API dependencies
  const response = await fetch("https://api.external.com/health");
  return response.ok;
}

module.exports = router;
```

### Application Metrics

```javascript
// monitoring/metrics.js
const prometheus = require("prom-client");

// Default metrics
prometheus.collectDefaultMetrics();

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
});

const httpRequestTotal = new prometheus.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const activeConnections = new prometheus.Gauge({
  name: "active_connections",
  help: "Number of active connections",
});

module.exports = {
  httpRequestDuration,
  httpRequestTotal,
  activeConnections,
  register: prometheus.register,
};
```

## Rollback Procedures

### Quick Rollback Strategy

```bash
#!/bin/bash
# scripts/rollback.sh

PREVIOUS_VERSION=$1

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: ./rollback.sh <previous_version>"
  exit 1
fi

echo "Rolling back to version $PREVIOUS_VERSION..."

# Kubernetes rollback
kubectl rollout undo deployment/myapp-deployment --to-revision=$PREVIOUS_VERSION

# Wait for rollback to complete
kubectl rollout status deployment/myapp-deployment

# Verify health
./scripts/health-check.sh

echo "Rollback completed"
```

### Database Rollback

```bash
#!/bin/bash
# scripts/rollback-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./rollback-db.sh <backup_file>"
  exit 1
fi

echo "Rolling back database from $BACKUP_FILE..."

# Stop application
kubectl scale deployment myapp-deployment --replicas=0

# Restore database
mysql --host=$DB_HOST --user=$DB_USER --password=$DB_PASSWORD $DB_NAME < $BACKUP_FILE

# Start application
kubectl scale deployment myapp-deployment --replicas=3

echo "Database rollback completed"
```

## Security Considerations

### Deployment Security Checklist

- [ ] Use HTTPS/TLS encryption
- [ ] Implement proper authentication
- [ ] Secure environment variables
- [ ] Regular security updates
- [ ] Network security (VPC, firewalls)
- [ ] Container security scanning
- [ ] Secrets management
- [ ] Access logging and monitoring

### Secrets Management

```bash
# Using Kubernetes secrets
kubectl create secret generic app-secrets \
  --from-literal=db-password=secret123 \
  --from-literal=jwt-secret=jwtsecret456

# Using HashiCorp Vault
vault kv put secret/myapp \
  db_password=secret123 \
  jwt_secret=jwtsecret456

# Using AWS Secrets Manager
aws secretsmanager create-secret \
  --name myapp/production \
  --secret-string '{"db_password":"secret123","jwt_secret":"jwtsecret456"}'
```

### SSL/TLS Configuration

```nginx
# nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name myapp.com;

    ssl_certificate /etc/nginx/ssl/myapp.crt;
    ssl_certificate_key /etc/nginx/ssl/myapp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Performance Optimization

### Production Optimizations

```javascript
// app.js production configuration
if (process.env.NODE_ENV === "production") {
  // Enable compression
  app.use(compression());

  // Set security headers
  app.use(helmet());

  // Enable trust proxy
  app.set("trust proxy", 1);

  // Configure session for production
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );
}
```

### Load Balancing

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  * hosts:
    * myapp.com
    secretName: myapp-tls
  rules:
  * host: myapp.com
    http:
      paths:
      * path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
```

## Troubleshooting

### Common Deployment Issues

#### Issue: Application Won't Start

```bash
# Check logs
kubectl logs deployment/myapp-deployment

# Check environment variables
kubectl describe pod <pod-name>

# Check resource limits
kubectl top pod <pod-name>

# Debug with shell access
kubectl exec -it <pod-name> -- /bin/sh
```

#### Issue: Database Connection Fails

```bash
# Test database connectivity
kubectl run db-test --image=mysql:9.0.1 --rm -it -- mysql -h$DB_HOST -u$DB_USER -p$DB_PASSWORD $DB_NAME

# Check network policies
kubectl get networkpolicy

# Verify secrets
kubectl get secret app-secrets -o yaml
```

#### Issue: Performance Problems

```bash
# Monitor resource usage
kubectl top nodes
kubectl top pods

# Check application metrics
curl https://myapp.com/metrics

# Analyze slow queries
tail -f /var/log/mysql/slow-query.log
```

### Deployment Verification Script

```bash
#!/bin/bash
# scripts/verify-deployment.sh

APP_URL=$1
EXPECTED_VERSION=$2

echo "Verifying deployment..."

# Check health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)
if [ $HEALTH_STATUS -ne 200 ]; then
  echo "Health check failed: HTTP $HEALTH_STATUS"
  exit 1
fi

# Check version
ACTUAL_VERSION=$(curl -s $APP_URL/health | jq -r '.version')
if [ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]; then
  echo "Version mismatch: expected $EXPECTED_VERSION, got $ACTUAL_VERSION"
  exit 1
fi

# Check database connectivity
curl -s $APP_URL/health/detailed | jq '.checks.database' | grep -q "healthy"
if [ $? -ne 0 ]; then
  echo "Database health check failed"
  exit 1
fi

echo "Deployment verification successful"
```

## Additional Resources

- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Docker Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/)
- [MySQL Backup and Recovery](https://dev.mysql.com/doc/refman/8.0/en/backup-and-recovery.html)
- [Application Security Guidelines](https://owasp.org/www-project-top-ten/)
