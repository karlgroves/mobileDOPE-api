# Global Rules

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) |
> [Node.js Standards](./node_structure_and_naming_conventions.md) |
> [API Operations](./operations-and-responses.md) | [Request Patterns](./request.md)

## Table of Contents

* [Authentication and Security](#authentication-and-security)
* [Rate Limiting](#rate-limiting)
* [CORS (Cross-Origin Resource Sharing) Policy](#cors-cross-origin-resource-sharing-policy)
* [JWT Bearer Token Format](#jwt-bearer-token-format)
* [File Size and Code Limits](#file-size-and-code-limits)

## Authentication and Security

* All requests to the API (other than the authentication and register routes) must have a JWT
  bearer token.
* All requests **should** have `Accept-Language` header set to a supported ISO 2-character language code.
* All responses **must** have `Content-Language` header set to an ISO 2-character language code
  which matches the `Accept-Language` header OR which defaults to `en`.
* All `GET`, `POST`, and `PUT` responses **must** have a `Content-Type` header with a value of `application/json`
* All `POST` and `PUT` requests **must** have a `Content-Type` header with a value of `application/json`
* All successful `DELETE` responses **must not** have a body.
* All `HEAD` responses **must not** have a body.
* `PUT` requests **may not** provide all possible fields in their requests.
* `PUT` requests **must** have the unique ID for the records being updated, however all other
  properties are optional (as the assumption is that any required properties were supplied during
  `POST`).
* All fields that are supplied during `PUT` requests must pass their relevant validation requirements.
* All successful `POST` and `PUT` requests will respond with the full object details as would be
  retrieved by a "`GET` by ID" request.
* All `description` fields (or fields with similar purpose) **must** accept Markdown
* All JSON responses **must* adhere to the [JSON specification](https://datatracker.ietf.org/doc/html/rfc8259)
* All connections **should** use `Keep-Alive`
* All routes **should** use `Content-Encoding: gzip`
* All dates & times **should** be stored in the database as UTC timestamps
* All dates & times, when returned by the API, **should** be RFC 3339 formatted.

## Rate Limiting

* **Rate Limit Policy**: API endpoints are protected by rate limiting to ensure fair usage and prevent abuse.
* **Default Limits**:
  * **Authenticated users**: 1,000 requests per hour per user
  * **Unauthenticated users**: 100 requests per hour per IP address
  * **Administrative endpoints**: 100 requests per hour per user
* **Rate Limit Headers**: All responses include rate limiting information:
  * `X-RateLimit-Limit`: Maximum number of requests allowed in the time window
  * `X-RateLimit-Remaining`: Number of requests remaining in the current window
  * `X-RateLimit-Reset`: Unix timestamp when the rate limit window resets
  * `Retry-After`: Number of seconds to wait before making another request (included when rate limited)
* **Rate Limit Responses**: When rate limits are exceeded:
  * Status Code: `429 Too Many Requests`
  * Response Body: Standard error format with `too_many_requests` code
  * Retry-After header with recommended wait time
* **Rate Limit Bypass**: Premium tier users and internal services may have higher limits or bypass rate limiting entirely
* **Endpoint-Specific Limits**: Critical endpoints may have stricter limits:
  * Authentication endpoints: 10 attempts per 15 minutes per IP
  * Password reset: 5 attempts per hour per email address
  * File upload endpoints: 20 requests per hour per user
* **Burst Handling**: Short bursts above the limit are allowed using a token bucket algorithm
* **Monitoring**: Rate limit violations are logged and monitored for security analysis

## CORS (Cross-Origin Resource Sharing) Policy

* **CORS Configuration**: All API endpoints must implement proper CORS headers to control cross-origin access.
* **Allowed Origins**: Configure specific allowed origins rather than using wildcard (`*`) in production:
  * Development: `http://localhost:3000`, `http://localhost:3001` (for local development)
  * Staging: `https://staging.example.com`, `https://staging-admin.example.com`
  * Production: `https://app.example.com`, `https://admin.example.com`
* **Allowed Methods**: Explicitly specify allowed HTTP methods:
  * Standard endpoints: `GET`, `POST`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`
  * Administrative endpoints: `GET`, `POST`, `PUT`, `DELETE` (no HEAD/OPTIONS for security)
* **Allowed Headers**: Define permitted request headers:
  * Required: `Content-Type`, `Authorization`, `Accept`, `Accept-Language`
  * Optional: `X-Requested-With`, `Cache-Control`, `X-Client-Version`
* **Exposed Headers**: Specify which response headers clients can access:
  * `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  * `Content-Language`, `Content-Length`, `Date`
  * `Location` (for 201/202 responses), `Retry-After` (for 429 responses)
* **Credentials Handling**:
  * `Access-Control-Allow-Credentials: true` for authenticated endpoints
  * Cookie-based authentication requires explicit origin allowlist (no wildcards)
* **Preflight Caching**: Set appropriate `Access-Control-Max-Age` header:
  * Development: 300 seconds (5 minutes) for faster iteration
  * Production: 86400 seconds (24 hours) for performance
* **Security Considerations**:
  * Never use `Access-Control-Allow-Origin: *` with credentials
  * Validate Origin header against allowlist before setting CORS headers
  * Log and monitor unauthorized CORS requests for security analysis
* **Environment-Specific Configuration**: Use environment variables for CORS origins:

  ```javascript
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  ```

## JWT Bearer Token Format

* **Token Structure**: All JWT bearer tokens must follow the standard JWT format with three base64url-encoded parts separated by dots
* **Header Format**: Standard JWT header specifying algorithm and token type:

  ```json
  {
    "alg": "HS256",
    "typ": "JWT"
  }
  ```

* **Payload Claims**: Required and optional claims for API access:

  ```json
  {
    "sub": "user-uuid-here",
    "email": "user@example.com",
    "role": "user|admin|premium",
    "iat": 1609459200,
    "exp": 1609545600,
    "iss": "api.example.com",
    "aud": "api.example.com"
  }
  ```

* **Authorization Header**: Bearer token format in request headers:

  ```http
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.\
    eyJzdWIiOiJ1c2VyLXV1aWQtaGVyZSIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNjA5NDU5MjAwLCJleHAiOjE2MDk1NDU2MDAsImlzcyI6ImFwaS5leGFtcGxlLmNvbSIsImF1ZCI6ImFwaS5leGFtcGxlLmNvbSJ9.\
    signature-hash-here
  ```

* **Token Validation Requirements**:
  * Verify signature using secret key
  * Check expiration time (`exp` claim)
  * Validate issuer (`iss`) and audience (`aud`) claims
  * Ensure token is not in blacklist/revocation list
* **Token Refresh**: Refresh tokens should be separate, longer-lived tokens stored securely
* **Security Considerations**:
  * Use strong, randomly generated secret keys (minimum 256 bits)
  * Implement token rotation for long-lived sessions
  * Store tokens securely on client side (httpOnly cookies preferred over localStorage)
  * Log authentication events for security monitoring

## Error Handling

* **Explicit Handling**: Prefer explicit error handling over silent failures (e.g., try/catch, Result/Either types)
* **Never Swallow Exceptions**: Never swallow exceptions without logging or justification
* **Fail Fast**: Validate input data before processing; fail fast and clearly
* **Meaningful Messages**: Provide clear, actionable error messages that help developers understand and fix issues
* **Error Logging**: All errors must be logged with appropriate context and severity levels
* **Recovery Strategies**: Implement recovery strategies where possible rather than crashing

## Security & Safety

* **Secure By Default**: Follow the principle of secure defaults - avoid insecure practices by default
* **No Hardcoded Secrets**: Never include hard-coded secrets, API keys, or passwords
* **Input Sanitization**: Sanitize and validate any user input before processing
* **SQL Injection Prevention**: Use parameterized queries or ORM features to prevent SQL injection
* **Authentication**: Implement proper authentication and authorization checks on all protected routes
* **HTTPS Only**: All production APIs must use HTTPS; redirect HTTP to HTTPS
* **Security Headers**: Implement security headers (CSP, X-Frame-Options, etc.) using helmet

## Performance Considerations

* **Avoid Premature Optimization**: Don't optimize until you have evidence of performance issues
* **No Obviously Inefficient Code**: Do not generate obviously inefficient code (e.g., nested O(n²) loops without explanation)
* **Flag Bottlenecks**: Flag any potential bottlenecks with comments
* **Database Query Optimization**: Use indexes appropriately and avoid N+1 query problems
* **Caching Strategy**: Implement caching where appropriate for frequently accessed data
* **Resource Cleanup**: Always clean up resources (database connections, file handles, etc.)

## File Size and Code Limits

* **Maximum File Sizes**:
  * **Source code files**: 1,000 lines maximum per file
  * **Documentation files**: 2,000 lines maximum per file
  * **Configuration files**: 500 lines maximum per file
  * **Test files**: 1,500 lines maximum per file
* **API Request Limits**:
  * **JSON payload**: 10 MB maximum size
  * **File uploads**: 50 MB maximum per file
  * **Bulk operations**: 1,000 records maximum per request
  * **Query parameters**: 100 parameters maximum per request
* **Database Limits**:
  * **Table records**: Implement pagination for queries returning >100 records
  * **VARCHAR fields**: 255 characters default, 1,000 characters maximum for descriptions
  * **TEXT fields**: 65,535 characters maximum (MySQL TEXT type)
  * **LONGTEXT fields**: Use only for content requiring >65K characters
* **Code Complexity Limits**:
  * **Function length**: 50 lines maximum (excluding comments and whitespace)
  * **Function parameters**: 5 parameters maximum (use object parameters for more)
  * **Nested conditionals**: 3 levels maximum depth
  * **Cyclomatic complexity**: 10 maximum per function
* **API Response Limits**:
  * **JSON response**: 5 MB maximum size
  * **Array results**: 100 items default, 1,000 items maximum with pagination
  * **Nested object depth**: 5 levels maximum to prevent circular references
  * **Response timeout**: 30 seconds maximum for API responses
* **Performance Thresholds**:
  * **Database queries**: 2 seconds maximum execution time
  * **API endpoints**: 5 seconds maximum response time
  * **File processing**: 30 seconds maximum for upload/processing operations
  * **Memory usage**: 512 MB maximum per request in production
* **Monitoring and Alerts**: Implement alerts when approaching 80% of any defined limit
