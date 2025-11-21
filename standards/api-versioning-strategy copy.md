# API Versioning Strategy

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) |
> [Operations & Responses](./operations-and-responses.md) | [Request Patterns](./request.md) |
> [Global Rules](./global-rules.md)

## Table of Contents

* [Purpose](#purpose)
* [Versioning Philosophy](#versioning-philosophy)
  * [Core Principles](#core-principles)
  * [Version Significance](#version-significance)
* [Versioning Methods](#versioning-methods)
  * [1. URL Path Versioning (Recommended)](#1-url-path-versioning-recommended)
  * [2. Header Versioning (Alternative)](#2-header-versioning-alternative)
  * [3. Content Negotiation (Specialized Use Cases)](#3-content-negotiation-specialized-use-cases)
* [Version Lifecycle Management](#version-lifecycle-management)
  * [Version States](#version-states)
  * [Lifecycle Timeline](#lifecycle-timeline)
  * [Version Support Policy](#version-support-policy)
* [Breaking Changes Management](#breaking-changes-management)
  * [What Constitutes a Breaking Change](#what-constitutes-a-breaking-change)
  * [Non-Breaking Changes](#non-breaking-changes)
  * [Breaking Change Process](#breaking-change-process)
* [Versioning Implementation Patterns](#versioning-implementation-patterns)
  * [Route Organization](#route-organization)
  * [Shared Logic Management](#shared-logic-management)
  * [Database Schema Evolution](#database-schema-evolution)
* [Deprecation Strategy](#deprecation-strategy)
  * [Deprecation Headers](#deprecation-headers)
  * [Deprecation Response Format](#deprecation-response-format)
  * [Communication Timeline](#communication-timeline)
* [Client Communication Strategy](#client-communication-strategy)
  * [Version Discovery](#version-discovery)
  * [Migration Guides](#migration-guides)
  * [Testing Version Compatibility](#testing-version-compatibility)
* [Monitoring and Analytics](#monitoring-and-analytics)
  * [Version Usage Tracking](#version-usage-tracking)
  * [Deprecation Metrics](#deprecation-metrics)
* [Best Practices Summary](#best-practices-summary)
  * [DO](#do)
  * [DON'T](#dont)
* [Resources](#resources)

## Purpose

This document defines the comprehensive API versioning strategy for REST-SPEC projects. It establishes standards
for version management, backward compatibility, deprecation processes, and migration strategies to ensure stable,
maintainable APIs.

## Versioning Philosophy

### Core Principles

* **Semantic Versioning**: Follow semver principles for API versions
* **Backward Compatibility**: Maintain compatibility within major versions
* **Graceful Deprecation**: Provide clear deprecation timelines and migration paths
* **Consumer-Focused**: Minimize breaking changes and disruption to API consumers
* **Documentation-Driven**: Maintain comprehensive version documentation

### Version Significance

* **Major Version (v1, v2, v3)**: Breaking changes that require consumer updates
* **Minor Version (v1.1, v1.2)**: New features that are backward compatible
* **Patch Version (v1.1.1, v1.1.2)**: Bug fixes and security updates

## Versioning Methods

### 1. URL Path Versioning (Recommended)

Include version in the URL path for clear, explicit versioning.

```http
GET /api/v1/users
GET /api/v2/users
GET /api/v1.2/users
```

**Advantages:**

* Clear and explicit
* Easy to implement
* Cacheable
* RESTful

**Implementation:**

```javascript
// Express.js router setup
const v1Router = express.Router();
const v2Router = express.Router();

app.use('/api/v1', v1Router);
app.use('/api/v2', v2Router);

// Version-specific routes
v1Router.get('/users', userControllerV1.getUsers);
v2Router.get('/users', userControllerV2.getUsers);
```

### 2. Header Versioning (Alternative)

Use custom headers for version specification.

```http
GET /api/users
API-Version: v1

GET /api/users
API-Version: v2
```

**Implementation:**

```javascript
// Middleware to handle version headers
const versionMiddleware = (req, res, next) => {
  const version = req.headers['api-version'] || 'v1';
  req.apiVersion = version;
  next();
};

// Controller logic
const getUsers = (req, res) => {
  switch (req.apiVersion) {
    case 'v1':
      return userControllerV1.getUsers(req, res);
    case 'v2':
      return userControllerV2.getUsers(req, res);
    default:
      return res.status(400).json({
        error: {
          code: 'invalid_version',
          message: 'Unsupported API version'
        }
      });
  }
};
```

### 3. Content Negotiation (Specialized Use Cases)

Use Accept header with custom media types.

```http
GET /api/users
Accept: application/vnd.api+json;version=1

GET /api/users
Accept: application/vnd.api+json;version=2
```

## Version Lifecycle Management

### Version States

1. **Development**: Pre-release, subject to breaking changes
2. **Active**: Current stable version, receiving new features
3. **Maintenance**: Stable version, receiving only bug fixes
4. **Deprecated**: Scheduled for removal, no new features
5. **Retired**: No longer supported

### Lifecycle Timeline

```text
Development → Active (6-12 months) → Maintenance (12-18 months) → Deprecated (6 months) → Retired
```

### Version Support Policy

* **Active Versions**: 1-2 major versions maximum
* **Maintenance Period**: Minimum 12 months for major versions
* **Deprecation Notice**: Minimum 6 months before retirement
* **Security Updates**: Provided for all non-retired versions

## Breaking Changes Management

### What Constitutes a Breaking Change

* Removing endpoints or fields
* Changing data types
* Modifying authentication requirements
* Altering error response formats
* Changing required parameters
* Modifying URL structures

### Non-Breaking Changes

* Adding new endpoints
* Adding optional parameters
* Adding new response fields
* Improving error messages
* Performance optimizations
* Bug fixes

### Breaking Change Process

1. **Planning Phase**: Identify necessity and impact
2. **Design Phase**: Design backward-compatible approach if possible
3. **Documentation Phase**: Document changes and migration guide
4. **Communication Phase**: Notify consumers with timeline
5. **Implementation Phase**: Implement with feature flags
6. **Migration Phase**: Support consumers through transition
7. **Cleanup Phase**: Remove deprecated features

## Versioning Implementation Patterns

### Route Organization

```text
src/
├── controllers/
│   ├── v1/
│   │   ├── userController.js
│   │   ├── teamController.js
│   │   └── index.js
│   ├── v2/
│   │   ├── userController.js
│   │   ├── teamController.js
│   │   └── index.js
│   └── shared/
│       ├── baseController.js
│       └── validationHelpers.js
├── routes/
│   ├── v1/
│   │   ├── users.js
│   │   ├── teams.js
│   │   └── index.js
│   ├── v2/
│   │   ├── users.js
│   │   ├── teams.js
│   │   └── index.js
│   └── index.js
├── models/
│   ├── v1/
│   │   └── userModel.js
│   ├── v2/
│   │   └── userModel.js
│   └── shared/
│       └── baseModel.js
└── services/
    ├── v1/
    │   └── userService.js
    ├── v2/
    │   └── userService.js
    └── shared/
        └── commonService.js
```

### Shared Logic Management

```javascript
// src/services/shared/baseUserService.js
class BaseUserService {
  constructor(userModel) {
    this.userModel = userModel;
  }

  async findById(id) {
    return this.userModel.findById(id);
  }

  async validateEmail(email) {
    // Shared validation logic
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

// src/services/v1/userService.js
const BaseUserService = require('../shared/baseUserService');

class UserServiceV1 extends BaseUserService {
  async createUser(userData) {
    // v1 specific logic
    return this.userModel.create(userData);
  }

  async formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }
}

// src/services/v2/userService.js
const BaseUserService = require('../shared/baseUserService');

class UserServiceV2 extends BaseUserService {
  async createUser(userData) {
    // v2 specific logic with additional validation
    if (!userData.firstName || !userData.lastName) {
      throw new ValidationError('First and last names are required');
    }
    return this.userModel.create(userData);
  }

  async formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      createdAt: user.createdAt
    };
  }
}
```

### Database Schema Evolution

```javascript
// migrations/20231201000001-create-users-v1.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  }
};

// migrations/20231201000002-update-users-v2.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns for v2
    await queryInterface.addColumn('users', 'first_name', {
      type: Sequelize.STRING,
      allowNull: true // Allow null during transition
    });
    
    await queryInterface.addColumn('users', 'last_name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Migrate existing data
    await queryInterface.sequelize.query(`
      UPDATE users 
      SET first_name = SUBSTRING_INDEX(name, ' ', 1),
          last_name = SUBSTRING_INDEX(name, ' ', -1)
      WHERE first_name IS NULL
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'first_name');
    await queryInterface.removeColumn('users', 'last_name');
  }
};
```

## Deprecation Strategy

### Deprecation Headers

```javascript
// Middleware to add deprecation headers
const deprecationMiddleware = (version, sunset) => {
  return (req, res, next) => {
    res.set({
      'Deprecation': 'true',
      'Sunset': sunset, // RFC 8594 format: Wed, 11 Nov 2024 07:28:00 GMT
      'Link': '</api/v2/users>; rel="successor-version"',
      'Warning': '299 - "This API version is deprecated"'
    });
    next();
  };
};

// Apply to deprecated routes
v1Router.use(deprecationMiddleware('v1', 'Wed, 11 Nov 2024 07:28:00 GMT'));
```

### Deprecation Response Format

```json
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "deprecation": {
    "version": "v1",
    "sunset": "2024-11-11T07:28:00Z",
    "message": "This API version is deprecated. Please migrate to v2.",
    "migration_guide": "https://api.example.com/docs/migration/v1-to-v2"
  }
}
```

### Communication Timeline

* **T-6 months**: Initial deprecation announcement
* **T-4 months**: Add deprecation headers to responses
* **T-2 months**: Final migration reminder
* **T-0**: Version retirement

## Client Communication Strategy

### Version Discovery

```javascript
// GET /api/versions
{
  "versions": [
    {
      "version": "v1",
      "status": "deprecated",
      "sunset": "2024-11-11T07:28:00Z",
      "documentation": "https://api.example.com/docs/v1"
    },
    {
      "version": "v2",
      "status": "active",
      "documentation": "https://api.example.com/docs/v2"
    }
  ],
  "recommended": "v2"
}
```

### Migration Guides

```markdown
# Migration Guide: v1 to v2

## Overview
API v2 introduces improved user data structure and enhanced authentication.

## Breaking Changes

### User Object Structure
**v1 Response:**
```json
{
  "id": "123",
  "email": "user@example.com",
  "name": "John Doe"
}
```

**v2 Response:**

```json
{
  "id": "123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe"
}
```

### Required Changes

1. Update user object parsing to handle `firstName` and `lastName`
2. Use `fullName` instead of `name` for display purposes
3. Update any logic that depends on the `name` field

## Code Examples

### JavaScript/Node.js

```javascript
// v1 code
const userName = user.name;

// v2 code
const userName = user.fullName;
const firstName = user.firstName;
const lastName = user.lastName;
```

### Testing Version Compatibility

```javascript
// tests/versioning/compatibility.test.js
describe('API Version Compatibility', () => {
  describe('v1 to v2 migration', () => {
    it('should maintain backward compatibility for existing fields', async () => {
      const v1Response = await request(app)
        .get('/api/v1/users/123')
        .expect(200);

      const v2Response = await request(app)
        .get('/api/v2/users/123')
        .expect(200);

      // v1 fields should be derivable from v2 response
      expect(v2Response.body.data.fullName).toBeDefined();
      expect(v2Response.body.data.firstName).toBeDefined();
      expect(v2Response.body.data.lastName).toBeDefined();
    });

    it('should include deprecation headers in v1 responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/123')
        .expect(200);

      expect(response.headers).toHaveProperty('deprecation');
      expect(response.headers).toHaveProperty('sunset');
    });
  });
});
```

## Monitoring and Analytics

### Version Usage Tracking

```javascript
// Middleware to track version usage
const versionAnalytics = (req, res, next) => {
  const version = req.baseUrl.match(/v(\d+)/)?.[1] || 'unknown';
  
  // Log version usage
  logger.info('API version used', {
    version,
    endpoint: req.originalUrl,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Increment metrics
  metrics.increment('api.version.usage', {
    version,
    endpoint: req.route?.path || req.originalUrl
  });

  next();
};
```

### Deprecation Metrics

```javascript
// Track deprecation warnings
const deprecationMetrics = (req, res, next) => {
  const version = req.baseUrl.match(/v(\d+)/)?.[1];
  
  if (version === '1') { // v1 is deprecated
    metrics.increment('api.deprecation.usage', {
      version: 'v1',
      endpoint: req.originalUrl
    });

    // Log for analysis
    logger.warn('Deprecated API version used', {
      version: 'v1',
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  next();
};
```

## Best Practices Summary

### DO

1. **Use semantic versioning** - Follow semver for clear version meaning
2. **Maintain backward compatibility** - Within major versions when possible
3. **Document everything** - Changes, deprecations, and migration paths
4. **Communicate early** - Give consumers adequate notice of changes
5. **Provide migration tools** - Automated tools when possible
6. **Monitor usage** - Track version adoption and deprecation impact
7. **Test thoroughly** - Ensure compatibility across versions
8. **Plan for the future** - Design with evolution in mind

### DON'T

1. **Don't break without notice** - Always communicate breaking changes
2. **Don't support too many versions** - Limit active versions to 2-3
3. **Don't rush deprecation** - Give adequate time for migration
4. **Don't forget documentation** - Keep version docs current
5. **Don't ignore feedback** - Listen to API consumer concerns
6. **Don't make arbitrary changes** - Ensure changes provide real value
7. **Don't skip testing** - Test all supported versions thoroughly
8. **Don't abandon old versions** - Support through deprecation period

## Resources

* [Semantic Versioning Specification](https://semver.org/)
* [RFC 8594 - Sunset Header](https://tools.ietf.org/html/rfc8594)
* [API Versioning Best Practices](https://restfulapi.net/versioning/)
* [Breaking Changes in APIs](https://nordicapis.com/what-are-breaking-changes-and-how-do-you-avoid-them/)
* [API Deprecation Best Practices](https://zapier.com/engineering/api-geriatrics/)
