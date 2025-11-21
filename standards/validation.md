# Validation Standards

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) | [Global Rules](./global-rules.md) |
> [Request Patterns](./request.md) | [Operations & Responses](./operations-and-responses.md)

## Table of Contents

* [Purpose](#purpose)
* [Core Validation Principles](#core-validation-principles)
  * [Security-First Approach](#security-first-approach)
  * [Data Integrity](#data-integrity)
* [Universal Validation Rules](#universal-validation-rules)
  * [Authentication and Authorization](#authentication-and-authorization)
  * [Data Type Handling](#data-type-handling)
* [Method-Specific Validation](#method-specific-validation)
  * [GET Requests](#get-requests)
    * [List Operations (`GET /api/resource`)](#list-operations-get-apiresource)
    * [Single Resource Operations (`GET /api/resource/:id`)](#single-resource-operations-get-apiresourceid)
  * [POST Requests](#post-requests)
    * [Create Operations (`POST /api/resource`)](#create-operations-post-apiresource)
  * [PUT Requests](#put-requests)
    * [Update Operations (`PUT /api/resource/:id`)](#update-operations-put-apiresourceid)
  * [DELETE Requests](#delete-requests)
    * [Delete Operations (`DELETE /api/resource/:id`)](#delete-operations-delete-apiresourceid)
  * [HEAD Requests](#head-requests)
    * [Existence Check (`HEAD /api/resource/:id`)](#existence-check-head-apiresourceid)
* [Advanced Validation Patterns](#advanced-validation-patterns)
  * [Input Sanitization](#input-sanitization)
  * [Complex Field Validation](#complex-field-validation)
  * [Conditional Validation](#conditional-validation)
* [Validation Error Handling](#validation-error-handling)
  * [Error Response Format](#error-response-format)
  * [Custom Error Classes](#custom-error-classes)
* [Schema Definition Patterns](#schema-definition-patterns)
  * [JSON Schema Validation](#json-schema-validation)
  * [Joi Schema Validation](#joi-schema-validation)
* [Performance Considerations](#performance-considerations)
  * [Validation Optimization](#validation-optimization)
  * [Rate Limiting for Validation](#rate-limiting-for-validation)
* [Security Best Practices](#security-best-practices)
  * [Input Validation Security](#input-validation-security)
  * [Common Attack Prevention](#common-attack-prevention)
* [Testing Validation Logic](#testing-validation-logic)
  * [Unit Testing Validation](#unit-testing-validation)
  * [Integration Testing](#integration-testing)
* [Migration from Legacy Validation](#migration-from-legacy-validation)
  * [Consolidation Strategy](#consolidation-strategy)
  * [Deprecated Files](#deprecated-files)
* [Resources](#resources)

## Purpose

This document consolidates all validation requirements for REST-SPEC APIs, combining general validation rules with
request-specific patterns. It serves as the comprehensive guide for input validation, security checks, and data
integrity enforcement.

## Core Validation Principles

### Security-First Approach

* **Input Sanitization**: All user inputs must be validated and sanitized before processing
* **Type Coercion**: Handle string-to-type conversion safely (e.g., URL parameters as strings)
* **Parameter Whitelisting**: Explicitly validate allowed parameters and ignore/unset others
* **Authentication Verification**: Validate JWT tokens and check blacklist status

### Data Integrity

* **Required Field Validation**: Enforce mandatory fields for each operation type
* **Format Validation**: Ensure data matches expected formats (UUID, email, etc.)
* **Business Logic Validation**: Apply domain-specific rules and constraints
* **Referential Integrity**: Verify foreign key relationships exist

## Universal Validation Rules

### Authentication and Authorization

All requests (except authentication and registration routes) must:

1. **JWT Token Validation**:
   * Validate JWT signature and structure according to [JWT validation standards](https://medium.com/dataseries/public-claims-and-how-to-validate-a-jwt-1d6c81823826)
   * Verify token expiration date
   * Check that JWT is not in the blacklist table
   * Extract user information for authorization checks

2. **Permission Verification**:
   * Verify user has appropriate permissions for the requested operation
   * Check ownership for user-specific resources
   * Validate role-based access for administrative operations

### Data Type Handling

* **String-to-Type Conversion**: Browser URL parameters arrive as strings; validation must handle type casting
* **UUID Validation**: Use regex pattern: `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
* **Integer Validation**: Cast string numbers to integers with bounds checking
* **Boolean Validation**: Accept `true`/`false`, `1`/`0`, `yes`/`no` with normalization

## Method-Specific Validation

### GET Requests

#### List Operations (`GET /api/resource`)

**Required Validation:**

* User has `read` permissions for the resource type
* User is owner of records OR has appropriate access level

**Optional Query Parameters:**

```javascript
{
  limit: {
    type: 'integer',
    optional: true,
    default: 100,
    maximum: 100,
    minimum: 1,
    note: 'Required if offset is supplied'
  },
  offset: {
    type: 'integer',
    optional: true,
    default: 0,
    minimum: 0
  },
  order: {
    type: 'string',
    optional: true,
    validation: 'Must be valid field name for resource type',
    note: 'Can include multiple fields for complex sorting'
  },
  dir: {
    type: 'enum',
    optional: true,
    values: ['asc', 'desc'],
    default: 'varies by resource type'
  },
  expand: {
    type: 'boolean',
    optional: true,
    default: false,
    note: 'Include related child objects'
  },
  q: {
    type: 'string',
    optional: true,
    note: 'Search query across searchable fields'
  }
}
```

**Security Requirements:**

* Ignore and unset all other query parameters
* Validate `order` field against allowed fields for resource type
* Prevent SQL injection through parameterized queries

**Default Ordering Rules:**

* **Date-based fields**: Most recent first (`created_at DESC`, `updated_at DESC`)
* **Name/Title fields**: Alphabetical ascending (`name ASC`, `title ASC`)
* **Priority/Status fields**: Custom business logic ordering

#### Single Resource Operations (`GET /api/resource/:id`)

**Required Validation:**

* `id` parameter is present and valid UUID
* Record exists in database
* User has read access to specific record

**Optional Parameters:**

* `expand`: Same as list operations

**Security Requirements:**

* Ignore all URL parameters except `id`
* Return 404 for both non-existent and unauthorized records (security through obscurity)

### POST Requests

#### Create Operations (`POST /api/resource`)

**Required Validation:**

* Request has `Content-Type: application/json` header
* JSON body is valid and parseable
* All required fields are present
* Field values pass format validation
* Business logic constraints are satisfied

**Standard Validation Flow:**

```javascript
// 1. Parse and validate JSON body
const data = await parseJsonBody(req);

// 2. Schema validation
const validatedData = await validateSchema(data, resourceSchema);

// 3. Business logic validation
await validateBusinessRules(validatedData);

// 4. Check for duplicates/conflicts
await checkDuplicates(validatedData);

// 5. Sanitize and format data
const sanitizedData = sanitizeInput(validatedData);
```

**Common Field Validations:**

* **Email**: RFC 5322 compliant regex
* **Phone**: E.164 international format
* **URLs**: Valid HTTP/HTTPS URLs only
* **Passwords**: Minimum complexity requirements
* **File uploads**: Type, size, and content validation

### PUT Requests

#### Update Operations (`PUT /api/resource/:id`)

**Required Validation:**

* `id` parameter is present and valid UUID
* Request has `Content-Type: application/json` header
* JSON body is valid and parseable
* Record exists in database
* User has write permissions for record

**Partial Update Support:**

* Only validate fields that are present in request body
* Do not require all fields (unlike POST)
* Maintain referential integrity for related records
* Preserve existing values for omitted fields

**Update Validation Flow:**

```javascript
// 1. Verify record exists and user has access
const existingRecord = await findAndAuthorize(id, user);

// 2. Validate only provided fields
const updates = await validatePartialSchema(data, resourceSchema);

// 3. Check business rules for updates
await validateUpdateRules(existingRecord, updates);

// 4. Merge with existing data
const mergedData = { ...existingRecord, ...updates };

// 5. Final validation of complete record
await validateCompleteRecord(mergedData);
```

### DELETE Requests

#### Delete Operations (`DELETE /api/resource/:id`)

**Required Validation:**

* `id` parameter is present and valid UUID
* Record exists in database
* User has delete permissions for record
* Check for dependent records (unless cascade delete is configured)

**Security Considerations:**

* Log all delete operations for audit trail
* Consider soft delete vs hard delete based on compliance requirements
* Validate cascade delete operations don't orphan critical data

### HEAD Requests

#### Existence Check (`HEAD /api/resource/:id`)

**Required Validation:**

* `id` parameter is present and valid UUID
* User has read permissions for resource type
* Return 200 if exists and accessible, 404 otherwise

## Advanced Validation Patterns

### Input Sanitization

```javascript
// HTML sanitization
const sanitizeHtml = (input) => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: []
  });
};

// SQL injection prevention
const sanitizeSql = (input) => {
  // Use parameterized queries instead of string concatenation
  return db.query('SELECT * FROM users WHERE id = ?', [input]);
};

// XSS prevention
const sanitizeXss = (input) => {
  return validator.escape(input);
};
```

### Complex Field Validation

```javascript
// Custom validators
const validators = {
  uniqueEmail: async (email, userId = null) => {
    const existing = await User.findOne({ 
      where: { 
        email,
        id: { [Op.ne]: userId } // Exclude current user for updates
      }
    });
    return !existing;
  },

  validDateRange: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start < end && start >= new Date();
  },

  phoneFormat: (phone) => {
    return /^\+[1-9]\d{1,14}$/.test(phone); // E.164 format
  }
};
```

### Conditional Validation

```javascript
// Validation that depends on other fields
const conditionalValidation = {
  // If user role is admin, additional fields are required
  adminFields: (data) => {
    if (data.role === 'admin') {
      const required = ['department', 'manager_id', 'access_level'];
      const missing = required.filter(field => !data[field]);
      if (missing.length > 0) {
        throw new ValidationError(`Admin users require: ${missing.join(', ')}`);
      }
    }
  },

  // Subscription-based feature validation
  premiumFeatures: async (data, user) => {
    const restrictedFeatures = ['advanced_analytics', 'custom_branding'];
    const requestedFeatures = Object.keys(data).filter(key => 
      restrictedFeatures.includes(key) && data[key]
    );
    
    if (requestedFeatures.length > 0 && !user.subscription?.isPremium) {
      throw new PaymentRequiredError('Premium features require subscription');
    }
  }
};
```

## Validation Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "bad_request",
    "message": "Validation failed",
    "params": [
      {
        "param": "email",
        "message": "Email address is invalid",
        "value": "invalid-email"
      },
      {
        "param": "password",
        "message": "Password must be at least 8 characters",
        "value": "[REDACTED]"
      }
    ]
  }
}
```

### Custom Error Classes

```javascript
class ValidationError extends Error {
  constructor(message, field = null, value = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'bad_request';
    this.field = field;
    this.value = value;
  }
}

class BusinessRuleError extends ValidationError {
  constructor(message, rule = null) {
    super(message);
    this.name = 'BusinessRuleError';
    this.rule = rule;
  }
}

class DuplicateError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'DuplicateError';
    this.statusCode = 422;
    this.code = 'duplicate';
    this.field = field;
  }
}
```

## Schema Definition Patterns

### JSON Schema Validation

```javascript
const userSchema = {
  type: 'object',
  required: ['email', 'name', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 255
    },
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 100,
      pattern: '^[a-zA-Z\\s]+$'
    },
    password: {
      type: 'string',
      minLength: 8,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'
    },
    age: {
      type: 'integer',
      minimum: 13,
      maximum: 120
    }
  },
  additionalProperties: false
};
```

### Joi Schema Validation

```javascript
const Joi = require('joi');

const userValidationSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  name: Joi.string().min(2).max(100).pattern(/^[a-zA-Z\s]+$/).required(),
  password: Joi.string().min(8).pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  ).required(),
  age: Joi.number().integer().min(13).max(120),
  preferences: Joi.object({
    notifications: Joi.boolean().default(true),
    theme: Joi.string().valid('light', 'dark').default('light')
  }).optional()
});
```

## Performance Considerations

### Validation Optimization

* **Schema Caching**: Cache compiled validation schemas
* **Early Exit**: Fail fast on first validation error
* **Async Validation**: Use Promise.all for independent async validations
* **Database Optimization**: Use indexes for uniqueness checks

### Rate Limiting for Validation

```javascript
// Separate rate limits for expensive validation operations
const validationRateLimits = {
  uniquenessCheck: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uniqueness checks per minute
    message: 'Too many validation requests'
  }),
  
  externalApiValidation: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes  
    max: 5, // 5 external API calls per 5 minutes
    message: 'External validation rate limit exceeded'
  })
};
```

## Security Best Practices

### Input Validation Security

1. **Whitelist Approach**: Define allowed inputs rather than blocked ones
2. **Multiple Validation Layers**: Client-side AND server-side validation
3. **Context-Aware Validation**: Different rules for different user roles
4. **Audit Logging**: Log validation failures for security monitoring

### Common Attack Prevention

* **SQL Injection**: Use parameterized queries exclusively
* **XSS Prevention**: Sanitize HTML content and escape output
* **LDAP Injection**: Validate and escape LDAP query parameters
* **Command Injection**: Never execute user input as system commands
* **Path Traversal**: Validate file paths and restrict directory access

## Testing Validation Logic

### Unit Testing Validation

```javascript
describe('User Validation', () => {
  it('should accept valid user data', async () => {
    const validUser = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'SecurePass123!'
    };
    
    const result = await validateUser(validUser);
    expect(result).toEqual(validUser);
  });

  it('should reject invalid email format', async () => {
    const invalidUser = {
      email: 'invalid-email',
      name: 'Test User',
      password: 'SecurePass123!'
    };
    
    await expect(validateUser(invalidUser))
      .rejects
      .toThrow(ValidationError);
  });
});
```

### Integration Testing

```javascript
describe('POST /api/users validation', () => {
  it('should return 400 for missing required fields', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com' }) // Missing name and password
      .expect(400);

    expect(response.body.error.code).toBe('bad_request');
    expect(response.body.error.params).toHaveLength(2);
  });
});
```

## Migration from Legacy Validation

### Consolidation Strategy

This document consolidates validation rules previously split between `validation.md` and `request.md`:

1. **Core Validation Logic**: Moved from `validation.md`
2. **Request Pattern Validation**: Integrated from `request.md`
3. **Enhanced Security**: Added modern security validation patterns
4. **Comprehensive Coverage**: Expanded to cover all HTTP methods and edge cases

### Deprecated Files

* `validation.md`: Content merged into this document
* `request.md`: Request pattern validation integrated here

Projects should update their documentation references to point to this consolidated validation standards document.

## Resources

* [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
* [JSON Schema Specification](https://json-schema.org/)
* [Joi Validation Library](https://joi.dev/)
* [Express Validator Documentation](https://express-validator.github.io/docs/)
* [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
