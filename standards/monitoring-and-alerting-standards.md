# Monitoring and Alerting Standards

This document establishes comprehensive monitoring and alerting standards for REST-Base applications,
ensuring proper observability, performance tracking, and incident response.

## Table of Contents

* [Overview](#overview)
* [Monitoring Philosophy](#monitoring-philosophy)
* [Key Performance Indicators (KPIs)](#key-performance-indicators-kpis)
* [Application Metrics](#application-metrics)
* [Infrastructure Metrics](#infrastructure-metrics)
* [Log Management](#log-management)
* [Alerting Rules](#alerting-rules)
* [Dashboards](#dashboards)
* [Error Tracking](#error-tracking)
* [Performance Monitoring](#performance-monitoring)
* [Security Monitoring](#security-monitoring)
* [Health Checks](#health-checks)
* [Implementation Examples](#implementation-examples)
* [Tools and Technologies](#tools-and-technologies)
* [Incident Response](#incident-response)

## Overview

### Monitoring Objectives

1. **Proactive Issue Detection** - Identify problems before they impact users
2. **Performance Optimization** - Track performance trends and bottlenecks
3. **Capacity Planning** - Monitor resource usage for scaling decisions
4. **Security Monitoring** - Detect suspicious activities and security threats
5. **Business Intelligence** - Track business metrics and user behavior
6. **Compliance** - Meet regulatory and audit requirements

### Monitoring Levels

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                    Business Metrics                        │
│  (User engagement, revenue, conversion rates)              │
├─────────────────────────────────────────────────────────────┤
│                  Application Metrics                       │
│  (Response times, error rates, throughput)                 │
├─────────────────────────────────────────────────────────────┤
│                 Infrastructure Metrics                     │
│  (CPU, memory, disk, network usage)                       │
├─────────────────────────────────────────────────────────────┤
│                     System Logs                           │
│  (Application logs, access logs, error logs)              │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring Philosophy

### The Four Golden Signals

1. **Latency** - How long requests take to complete
2. **Traffic** - How much demand is placed on the system
3. **Errors** - Rate of requests that fail
4. **Saturation** - How "full" the service is

### SLI, SLO, and SLA Framework

#### Service Level Indicators (SLIs)

* Specific metrics that measure service performance
* Must be measurable and meaningful to users

#### Service Level Objectives (SLOs)

* Target values or ranges for SLIs
* Internal goals for service reliability

#### Service Level Agreements (SLAs)

* External commitments to customers
* Often based on SLOs with stricter requirements

```yaml
# Example SLI/SLO definitions
slis:
  availability:
    description: "Percentage of successful HTTP requests"
    measurement: "count(http_requests{status!~'5..'})/count(http_requests)"
  
  latency:
    description: "95th percentile response time"
    measurement: "histogram_quantile(0.95, http_request_duration_seconds)"

slos:
  availability: 99.9%  # 43.8 minutes downtime per month
  latency: 200ms       # 95th percentile under 200ms
  error_rate: 0.1%     # Less than 0.1% error rate
```

## Key Performance Indicators (KPIs)

### Application Performance KPIs

| Metric | Target | Critical Threshold | Alert Level |
|--------|--------|--------------------|-------------|
| Response Time (p95) | < 200ms | > 500ms | Warning |
| Response Time (p99) | < 500ms | > 1000ms | Critical |
| Error Rate | < 0.1% | > 1% | Critical |
| Availability | > 99.9% | < 99% | Critical |
| Throughput | Baseline ±20% | > 50% deviation | Warning |

### Business KPIs

| Metric | Target | Critical Threshold | Alert Level |
|--------|--------|--------------------|-------------|
| Daily Active Users | Baseline ±10% | > 25% decrease | Warning |
| Conversion Rate | Baseline ±5% | > 15% decrease | Critical |
| Revenue per Hour | Baseline ±15% | > 30% decrease | Critical |
| User Session Duration | > 5 minutes | < 2 minutes | Warning |

### Infrastructure KPIs

| Metric | Target | Critical Threshold | Alert Level |
|--------|--------|--------------------|-------------|
| CPU Utilization | < 70% | > 90% | Critical |
| Memory Usage | < 80% | > 95% | Critical |
| Disk Usage | < 85% | > 95% | Critical |
| Network I/O | Baseline ±30% | > 80% capacity | Warning |

## Application Metrics

### HTTP Request Metrics

```javascript
// metrics/http.js
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestSizeBytes = new prometheus.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route']
});

const httpResponseSizeBytes = new prometheus.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code']
});

module.exports = {
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSizeBytes,
  httpResponseSizeBytes
};
```

### Database Metrics

```javascript
// metrics/database.js
const prometheus = require('prom-client');

const dbConnectionPoolSize = new prometheus.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current size of database connection pool'
});

const dbConnectionPoolUsed = new prometheus.Gauge({
  name: 'db_connection_pool_used',
  help: 'Number of used database connections'
});

const dbQueryDuration = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const dbQueryTotal = new prometheus.Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status']
});

module.exports = {
  dbConnectionPoolSize,
  dbConnectionPoolUsed,
  dbQueryDuration,
  dbQueryTotal
};
```

### Business Metrics

```javascript
// metrics/business.js
const prometheus = require('prom-client');

const userRegistrations = new prometheus.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source', 'plan']
});

const userLogins = new prometheus.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method', 'status']
});

const orderValue = new prometheus.Histogram({
  name: 'order_value_dollars',
  help: 'Order value in dollars',
  labelNames: ['category', 'payment_method'],
  buckets: [10, 25, 50, 100, 250, 500, 1000]
});

const activeUsers = new prometheus.Gauge({
  name: 'active_users',
  help: 'Number of currently active users'
});

module.exports = {
  userRegistrations,
  userLogins,
  orderValue,
  activeUsers
};
```

## Infrastructure Metrics

### System Resource Monitoring

```yaml
# prometheus.yml - System metrics configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  * "alert_rules.yml"

scrape_configs:
  * job_name: 'node-exporter'
    static_configs:
      * targets: ['localhost:9100']
    scrape_interval: 5s
    metrics_path: /metrics

  * job_name: 'application'
    static_configs:
      * targets: ['app:3000']
    scrape_interval: 15s
    metrics_path: /metrics

  * job_name: 'postgres-exporter'
    static_configs:
      * targets: ['postgres-exporter:9187']

  * job_name: 'redis-exporter'
    static_configs:
      * targets: ['redis-exporter:9121']
```

### Container Metrics

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      * "9090:9090"
    volumes:
      * ./prometheus.yml:/etc/prometheus/prometheus.yml
      * ./alert_rules.yml:/etc/prometheus/alert_rules.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      * "3001:3000"
    environment:
      * GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      * grafana-storage:/var/lib/grafana

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      * "9100:9100"
    volumes:
      * /proc:/host/proc:ro
      * /sys:/host/sys:ro
      * /:/rootfs:ro
    command:
      * '--path.procfs=/host/proc'
      * '--path.sysfs=/host/sys'
      * '--collector.filesystem.ignored-mount-points=^/(sys|proc|dev|host|etc)($$|/)'

volumes:
  grafana-storage:
```

## Log Management

### Structured Logging Standards

```javascript
// utils/logger.js
const bunyan = require('bunyan');
const path = require('path');

// Create streams array
const streams = [
  {
    level: 'info',
    stream: process.stdout
  }
];

// Add file streams for production
if (process.env.NODE_ENV === 'production') {
  streams.push({
    level: 'error',
    path: path.join('logs', 'error.log'),
    type: 'rotating-file',
    period: '1d',
    count: 5
  });
  
  streams.push({
    level: 'info',
    path: path.join('logs', 'combined.log'),
    type: 'rotating-file',
    period: '1d',
    count: 5
  });
}

const logger = bunyan.createLogger({
  name: process.env.SERVICE_NAME || 'rest-api',
  level: process.env.LOG_LEVEL || 'info',
  serializers: bunyan.stdSerializers,
  streams,
  src: process.env.NODE_ENV !== 'production', // Include source file info in dev
  service: process.env.SERVICE_NAME || 'rest-api',
  version: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development'
});

module.exports = logger;
```

### Log Levels and Usage

| Level | When to Use | Example |
|-------|-------------|---------|
| ERROR | Application errors, exceptions | `logger.error('Database connection failed', { error: err.message })` |
| WARN | Potentially harmful situations | `logger.warn('High memory usage detected', { usage: '85%' })` |
| INFO | General information about application flow | `logger.info('User logged in', { userId: 123, ip: req.ip })` |
| DEBUG | Detailed information for debugging | `logger.debug('Cache hit', { key: 'user:123', ttl: 300 })` |

### Security Event Logging

```javascript
// middleware/securityLogger.js
const logger = require('../utils/logger');

function logSecurityEvent(req, res, next) {
  // Log authentication attempts
  if (req.path === '/auth/login') {
    logger.info('Authentication attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body.email,
      success: res.statusCode === 200
    });
  }
  
  // Log failed authorization
  if (res.statusCode === 403) {
    logger.warn('Authorization failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });
  }
  
  // Log suspicious activities
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i  // SQL injection
  ];
  
  const queryString = req.url;
  if (suspiciousPatterns.some(pattern => pattern.test(queryString))) {
    logger.error('Suspicious request detected', {
      ip: req.ip,
      path: req.path,
      query: req.query,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
}

module.exports = logSecurityEvent;
```

## Alerting Rules

### Prometheus Alert Rules

```yaml
# alert_rules.yml
groups:
  * name: application_alerts
    rules:
      * alert: HighErrorRate
        expr: (rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      * alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "95th percentile latency is {{ $value }}s"

      * alert: DatabaseConnectionFailure
        expr: db_connection_pool_used / db_connection_pool_size > 0.9
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Connection pool usage is {{ $value | humanizePercentage }}"

  * name: infrastructure_alerts
    rules:
      * alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

      * alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 95
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

      * alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 95
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low"
          description: "Disk usage is {{ $value }}% on {{ $labels.instance }}"

  * name: business_alerts
    rules:
      * alert: LowConversionRate
        expr: rate(user_registrations_total[1h]) < 10
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "Low conversion rate"
          description: "User registration rate is {{ $value }} per hour"
```

### Alert Severity Levels

| Severity | Response Time | Escalation | Examples |
|----------|---------------|------------|----------|
| Critical | Immediate (< 5 min) | On-call engineer | Service down, data corruption |
| Warning | 30 minutes | Team lead | High latency, resource usage |
| Info | Next business day | Team notification | Deployment success, capacity alerts |

## Dashboards

### Application Dashboard

```json
{
  "dashboard": {
    "title": "REST API Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"4..\"}[5m])",
            "legendFormat": "4xx errors"
          },
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

### Infrastructure Dashboard

```json
{
  "dashboard": {
    "title": "Infrastructure Overview",
    "panels": [
      {
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Network I/O",
        "targets": [
          {
            "expr": "rate(node_network_receive_bytes_total[5m])",
            "legendFormat": "Received {{device}}"
          },
          {
            "expr": "rate(node_network_transmit_bytes_total[5m])",
            "legendFormat": "Transmitted {{device}}"
          }
        ]
      }
    ]
  }
}
```

## Error Tracking

### Error Monitoring Setup

```javascript
// utils/errorTracking.js
const Sentry = require('@sentry/node');
const logger = require('./logger');

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app: require('../app') })
  ]
});

function captureError(error, context = {}) {
  // Log error
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    context
  });
  
  // Send to Sentry
  Sentry.withScope((scope) => {
    Object.keys(context).forEach(key => {
      scope.setTag(key, context[key]);
    });
    Sentry.captureException(error);
  });
}

function captureMessage(message, level = 'info', context = {}) {
  logger[level](message, context);
  
  Sentry.withScope((scope) => {
    Object.keys(context).forEach(key => {
      scope.setTag(key, context[key]);
    });
    Sentry.captureMessage(message, level);
  });
}

module.exports = {
  Sentry,
  captureError,
  captureMessage
};
```

### Error Classification

| Category | Severity | Auto-Resolution | Examples |
|----------|----------|-----------------|----------|
| Critical | High | No | Database unavailable, payment processing failure |
| Business | Medium | No | Validation errors, authentication failures |
| Technical | Low | Yes | Temporary network issues, cache misses |
| User | Info | Yes | Invalid input, permission denied |

## Performance Monitoring

### Application Performance Monitoring (APM)

```javascript
// monitoring/apm.js
const elastic = require('@elastic/apm-node');

// Initialize Elastic APM
const apm = elastic.start({
  serviceName: process.env.SERVICE_NAME || 'rest-api',
  serverUrl: process.env.ELASTIC_APM_SERVER_URL,
  environment: process.env.NODE_ENV,
  captureBody: 'errors',
  captureHeaders: true,
  logLevel: 'info'
});

// Custom transaction tracking
function trackTransaction(name, type, callback) {
  const transaction = apm.startTransaction(name, type);
  
  return new Promise((resolve, reject) => {
    callback()
      .then(result => {
        transaction.result = 'success';
        resolve(result);
      })
      .catch(error => {
        apm.captureError(error);
        transaction.result = 'error';
        reject(error);
      })
      .finally(() => {
        transaction.end();
      });
  });
}

// Database query tracking
function trackDatabaseQuery(query, params) {
  const span = apm.startSpan('db.query', 'db', 'postgresql', 'query');
  span.setDbContext({
    statement: query,
    type: 'sql'
  });
  
  return span;
}

module.exports = {
  apm,
  trackTransaction,
  trackDatabaseQuery
};
```

### Performance Benchmarks

```javascript
// tests/performance/benchmarks.js
const autocannon = require('autocannon');
const app = require('../../app');

async function runPerformanceTests() {
  const server = app.listen(0);
  const port = server.address().port;
  
  const tests = [
    {
      name: 'GET /health',
      url: `http://localhost:${port}/health`,
      duration: 30,
      connections: 10
    },
    {
      name: 'GET /api/users',
      url: `http://localhost:${port}/api/users`,
      duration: 30,
      connections: 10,
      headers: {
        'Authorization': 'Bearer test-token'
      }
    }
  ];
  
  for (const test of tests) {
    console.log(`Running test: ${test.name}`);
    const result = await autocannon(test);
    
    // Assert performance requirements
    expect(result.latency.p95).toBeLessThan(500); // 95th percentile under 500ms
    expect(result.requests.average).toBeGreaterThan(100); // Average RPS over 100
    expect(result.errors).toBe(0); // No errors
    
    console.log(`Results: ${result.requests.average} req/sec, ${result.latency.p95}ms p95`);
  }
  
  server.close();
}

module.exports = runPerformanceTests;
```

## Security Monitoring

### Security Event Detection

```javascript
// middleware/securityMonitoring.js
const rateLimit = require('express-rate-limit');
const { captureMessage } = require('../utils/errorTracking');

// Rate limiting with monitoring
const createRateLimiter = (windowMs, max, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests,
    onLimitReached: (req, res, options) => {
      captureMessage('Rate limit exceeded', 'warning', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        limit: options.max,
        window: options.windowMs
      });
    }
  });
};

// Brute force protection
const loginLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

// API rate limiting
const apiLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes

// CSRF attack detection
function detectCSRF(req, res, next) {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (req.method !== 'GET' && !allowedOrigins.includes(origin)) {
    captureMessage('Potential CSRF attack detected', 'warning', {
      ip: req.ip,
      origin,
      referer,
      path: req.path
    });
  }
  
  next();
}

module.exports = {
  loginLimiter,
  apiLimiter,
  detectCSRF
};
```

### Security Metrics

```javascript
// metrics/security.js
const prometheus = require('prom-client');

const securityEvents = new prometheus.Counter({
  name: 'security_events_total',
  help: 'Total number of security events',
  labelNames: ['type', 'severity', 'ip']
});

const authenticationAttempts = new prometheus.Counter({
  name: 'authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['method', 'result', 'ip']
});

const rateLimitHits = new prometheus.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ip']
});

module.exports = {
  securityEvents,
  authenticationAttempts,
  rateLimitHits
};
```

## Health Checks

### Comprehensive Health Check Implementation

```javascript
// routes/health.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const redis = require('../redis');
const { version } = require('../package.json');

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: process.uptime()
  });
});

// Detailed health check
router.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkDiskSpace(),
    checkMemoryUsage(),
    checkExternalServices()
  ]);

  const results = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: process.uptime(),
    response_time: Date.now() - startTime,
    checks: {
      database: formatCheckResult(checks[0]),
      redis: formatCheckResult(checks[1]),
      disk_space: formatCheckResult(checks[2]),
      memory: formatCheckResult(checks[3]),
      external_services: formatCheckResult(checks[4])
    }
  };

  const isHealthy = Object.values(results.checks).every(check => check.status === 'healthy');
  results.status = isHealthy ? 'healthy' : 'unhealthy';

  res.status(isHealthy ? 200 : 503).json(results);
});

// Readiness check for Kubernetes
router.get('/ready', async (req, res) => {
  try {
    await checkDatabase();
    await checkRedis();
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// Liveness check for Kubernetes
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

async function checkDatabase() {
  const start = Date.now();
  const result = await db.raw('SELECT 1 as test');
  return {
    status: 'healthy',
    response_time: Date.now() - start,
    details: 'Database connection successful'
  };
}

async function checkRedis() {
  const start = Date.now();
  await redis.ping();
  return {
    status: 'healthy',
    response_time: Date.now() - start,
    details: 'Redis connection successful'
  };
}

function formatCheckResult(result) {
  if (result.status === 'fulfilled') {
    return result.value;
  } else {
    return {
      status: 'unhealthy',
      error: result.reason.message
    };
  }
}

module.exports = router;
```

## Implementation Examples

### Express.js Integration

```javascript
// app.js
const express = require('express');
const prometheus = require('prom-client');
const { Sentry } = require('./utils/errorTracking');
const logger = require('./utils/logger');
const healthRoutes = require('./routes/health');

const app = express();

// Sentry request handler (must be first)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// Prometheus metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
      
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
});

// Health check routes
app.use(healthRoutes);

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});

// Sentry error handler (must be last)
app.use(Sentry.Handlers.errorHandler());

module.exports = app;
```

## Tools and Technologies

### Recommended Monitoring Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics Collection | Prometheus | Time-series metrics storage |
| Visualization | Grafana | Dashboards and alerting |
| Log Aggregation | ELK Stack (Elasticsearch, Logstash, Kibana) | Log collection and analysis |
| APM | Elastic APM / New Relic | Application performance monitoring |
| Error Tracking | Sentry | Error tracking and alerting |
| Uptime Monitoring | Pingdom / UptimeRobot | External service monitoring |

### Cloud Provider Solutions

**AWS**

* CloudWatch for metrics and logs
* X-Ray for distributed tracing
* CloudTrail for audit logs

**Google Cloud Platform**

* Cloud Monitoring (Stackdriver)
* Cloud Logging
* Cloud Trace

**Azure**

* Azure Monitor
* Application Insights
* Log Analytics

## Incident Response

### Incident Severity Classification

| Level | Impact | Response Time | Escalation |
|-------|--------|---------------|------------|
| P0 - Critical | Service completely down | 5 minutes | Immediate on-call |
| P1 - High | Major functionality impaired | 30 minutes | Senior engineer |
| P2 - Medium | Some functionality impaired | 2 hours | Team lead |
| P3 - Low | Minor issues | Next business day | Regular team |

### Incident Response Procedures

1. **Detection** - Automated alerts or user reports
2. **Assessment** - Determine severity and impact
3. **Response** - Assign responder and begin mitigation
4. **Communication** - Update stakeholders
5. **Resolution** - Fix the issue and verify
6. **Post-mortem** - Learn from the incident

### Runbook Example

```markdown
# High Error Rate Runbook

## Symptoms
* Error rate > 1% for more than 2 minutes
* 5xx HTTP status codes increasing

## Investigation Steps
1. Check application logs for error patterns
2. Verify database connectivity
3. Check third-party service status
4. Review recent deployments

## Mitigation Steps
1. If deployment-related: rollback to previous version
2. If database issue: restart database connections
3. If traffic spike: scale application instances
4. If third-party issue: enable circuit breaker

## Communication
* Update status page
* Notify affected customers
* Post in #incidents Slack channel
```

This comprehensive monitoring and alerting standards document provides the foundation for maintaining
reliable, observable REST-Base applications with proactive issue detection and rapid incident
response capabilities.
