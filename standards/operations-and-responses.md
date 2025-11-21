# Operations and Responses

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) | [Global Rules](./global-rules.md) |
> [Request Patterns](./request.md) | [✅ Validation](./validation.md)

## Table of Contents

* [HTTP Status Codes](#http-status-codes)
* [Responses](#responses)
  * [Success](#success)
  * [Errors](#errors)
* [Request/Response Correlation ID Patterns](#requestresponse-correlation-id-patterns)
  * [Correlation ID Implementation](#correlation-id-implementation)
    * [Header Format](#header-format)
    * [Client-Generated Correlation IDs](#client-generated-correlation-ids)
    * [Server-Generated Correlation IDs](#server-generated-correlation-ids)
    * [Response Header Example](#response-header-example)
  * [Error Response Correlation](#error-response-correlation)
  * [Logging Integration](#logging-integration)
  * [Microservices Propagation](#microservices-propagation)
  * [Database Query Correlation](#database-query-correlation)
  * [Correlation ID Best Practices](#correlation-id-best-practices)

## HTTP Status Codes

This API uses the following HTTP status codes in the HTTP Response Headers:

* `200` is returned with status `OK` whenever `GET`, `PUT`, and `HEAD` operations were successful
* `201` is returned with status `Created` whenever a `POST` operation was successful
* `202` is returned with status `Accepted` whenever a `POST` or `PUT` operation was successful but the final result
  of the operation is expected to take longer than 500ms.
* `204` is returned with status `No Content` whenever a `DELETE` operation was successful
* `400` is returned with status `Bad Request` whenever an operation has failed due to a validation failure.
  Validation failures include a required parameter missing or a parameter out of bounds
* `401` is returned with status `Unauthorized` whenever an operation has failed due to insufficient permissions.
  Users will see this whenever they're either trying to access an admin-only operation or trying to access a
  user-created resource that they were not the creator of but have permissions to access. For instance, all users
  can see the teams they're a part of, but they cannot edit a team they did not create.
* `402` is returned with status `Payment Required` whenever a user has attempted an operation against a resource
  that requires a subscription
* `404` is returned with status `Not Found` whenever an operation has failed because the resource does not exist.
  As a safety measure, we also return `404` if the item does exist but the user making the request does not have
  access to it.
* `405` is returned with status `Method Not Allowed` whenever an operation is attempted with anything other than
  the following request types: `GET`, `POST`, `PUT`, `DELETE`, or `HEAD`.
* `422` is returned with status `Unprocessable Entity` whenever the requester is attempting to `POST` another
  record for an object type that can have only one. For example: when trying to `POST` user preferences, because
  a user can have only one preferences record.
* `429` is returned with status `Too Many Requests` whenever the requester has submitted too many requests in
  too short a period
* `500` is returned with status `Internal Server Error` whenever there's a problem with the API itself or a
  related dependent service

## Responses

### Success

As described above, all successful responses come with an HTTP `2xx` response.

* Successful `GET` requests with `200` response will have a response body consisting of an array of the objects
  requested. The object structure will depend on the type of object.
* Successful "`GET` by ID" requests with `200` response will have a response body consisting of the object
  requested. The object structure will depend on the type of object.
* Successful `POST` requests will always return a `201` response and the response body will echo back the newly
  created object.
* Successful `POST` and `PUT` requests that are expected to take longer than 500ms will always return a `202`
  response and the response will contain a `location` header with a link to the newly created object and a
  `retry-after` header with the number of seconds to wait before checking the status of the operation.
* Successful `PUT` requests will always return a `200` response and the response body will echo back the object
  in its updated state.
* Successful `DELETE` requests will always return a `204` response and _will not have a response body_.
* Successful `HEAD` requests will always return a `200` response and _will not have a response body_.

### Errors

* All error responses will come with an HTTP `4xx` response other than internal server errors.
* All error responses will feature the same structure in the response body as shown below.

```json
{
  "error": {
    "code": "bad_request",
    "message": "Human-readable message",
    "params": [
        {
            "param": "foo",
            "message": "Foo is required"
        }
    ]
  }
}
```

* `message` will provide a human-readable error message describing the error. This message should be user-friendly
  and clear enough that its value can be used directly in client applications.
* For `bad_request` responses, the information provided within the `params` array will provide additional
  field-by-field details to help recover. NOTE: `params` is only provided for `400` responses.
* The value within `code` will be one of the following token values:
  * `bad_request` is returned with all `400` responses. In this case, it means that either a required parameter
    was missing or a parameter was supplied with an invalid value. When that happens, there will be a `params`
    array which features an object for each parameter that was invalid. Each of those objects will have two
    properties:
    * `param`: the name of the parameter that is invalid
    * `message`: a human readable message indicating how the param is failing validation. This is meant to be
      user-friendly and clear enough that it can be used directly in client applications. Its content will be
      returned in the language matching the `Content-Language` header in the response.
  * `duplicate` is returned with all `422` responses.
  * `unauthorized` is returned with all `401` responses
  * `payment_required` is returned with all `402` responses
  * `not_found` is returned with all `404` responses
  * `method_not_allowed` is returned with all `405` responses
  * `too_many_requests` is returned with all `429` responses
  * `internal_server_error` is returned with all `500` responses

## Request/Response Correlation ID Patterns

### Correlation ID Implementation

All API requests and responses should include correlation IDs for request tracking, debugging, and distributed
system tracing.

#### Header Format

* **Request Header**: `X-Correlation-ID` or `X-Request-ID`
* **Response Header**: Same correlation ID echoed back in response
* **Generated ID Format**: UUID v4 format (`550e8400-e29b-41d4-a716-446655440000`)

#### Client-Generated Correlation IDs

```http
GET /api/users/123
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
Accept: application/json
Authorization: Bearer jwt-token-here
```

#### Server-Generated Correlation IDs

When client doesn't provide correlation ID, server generates one:

```javascript
// Middleware to ensure correlation ID exists
const correlationMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       uuidv4();
  
  req.correlationId = correlationId;
  res.set('X-Correlation-ID', correlationId);
  next();
};
```

#### Response Header Example

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999

{
  "data": {
    "id": "123",
    "email": "user@example.com"
  }
}
```

### Error Response Correlation

Error responses must include correlation ID for troubleshooting:

```json
{
  "error": {
    "code": "not_found",
    "message": "User not found",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Logging Integration

Include correlation ID in all log messages for request tracing:

```javascript
// Logger with correlation ID
const logger = bunyan.createLogger({
  name: 'rest-api',
  serializers: bunyan.stdSerializers,
  streams: [{
    stream: process.stdout,
    level: 'info'
  }]
});

// Log with correlation ID
const childLogger = logger.child({ correlationId: req.correlationId });

// Usage in request handler
app.get('/api/users/:id', (req, res) => {
  const childLogger = logger.child({ correlationId: req.correlationId });
  childLogger.info({
    userId: req.params.id,
    userAgent: req.get('User-Agent')
  }, 'Fetching user');
});
```

### Microservices Propagation

Pass correlation ID through service calls:

```javascript
// Service-to-service call
const fetchUserProfile = async (userId, correlationId) => {
  const response = await axios.get(`${profileServiceUrl}/users/${userId}`, {
    headers: {
      'X-Correlation-ID': correlationId,
      'Authorization': `Bearer ${serviceToken}`
    }
  });
  return response.data;
};
```

### Database Query Correlation

Include correlation ID in database query logging:

```javascript
// Sequelize with correlation ID
const user = await User.findByPk(userId, {
  logging: (sql) => logger.debug('Database query', {
    correlationId: req.correlationId,
    sql: sql,
    operation: 'findByPk'
  })
});
```

### Correlation ID Best Practices

* **Uniqueness**: Use UUID v4 to ensure global uniqueness
* **Propagation**: Pass correlation ID through all service layers
* **Persistence**: Store correlation ID with async operations and background jobs
* **Client Libraries**: Provide SDKs that automatically generate correlation IDs
* **Monitoring**: Use correlation IDs for distributed tracing and error tracking
* **Documentation**: Include correlation ID examples in API documentation
