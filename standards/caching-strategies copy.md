# Caching Strategies

This document outlines comprehensive caching strategies for REST-Base applications, covering various caching layers,
implementation patterns, and best practices to optimize performance and scalability.

## Table of Contents

* [Overview](#overview)
* [Caching Layers](#caching-layers)
* [Cache Types and Patterns](#cache-types-and-patterns)
* [Implementation Strategies](#implementation-strategies)
* [Cache Invalidation](#cache-invalidation)
* [Performance Considerations](#performance-considerations)
* [Security Considerations](#security-considerations)
* [Best Practices](#best-practices)
* [Troubleshooting](#troubleshooting)

## Overview

### Caching Benefits

1. **Performance Improvement** - Reduce response times and server load
2. **Scalability** - Handle more concurrent users with same resources
3. **Cost Reduction** - Lower infrastructure and bandwidth costs
4. **Availability** - Provide fallback during service outages
5. **User Experience** - Faster page loads and better responsiveness

### Cache Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│                    Browser Cache                           │
│              (Client-side caching)                         │
├─────────────────────────────────────────────────────────────┤
│                      CDN Cache                             │
│              (Edge/Geographic caching)                     │
├─────────────────────────────────────────────────────────────┤
│                 Application Cache                          │
│           (In-memory/Redis caching)                        │
├─────────────────────────────────────────────────────────────┤
│                  Database Cache                            │
│              (Query result caching)                        │
└─────────────────────────────────────────────────────────────┘
```

## Caching Layers

### 1. Browser/Client-Side Caching

Control browser caching through HTTP headers:

```javascript
// middleware/cacheHeaders.js
function setCacheHeaders(req, res, next) {
  const path = req.path;
  
  if (path.match(/\.(css|js|img|font)/)) {
    // Static assets - cache for 1 year
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Expires': new Date(Date.now() + 31536000000).toUTCString()
    });
  } else if (path.startsWith('/api/')) {
    // API responses - cache for 5 minutes
    res.set({
      'Cache-Control': 'public, max-age=300',
      'ETag': generateETag(req)
    });
  } else {
    // HTML pages - cache for 1 hour with revalidation
    res.set({
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'Last-Modified': new Date().toUTCString()
    });
  }
  
  next();
}

function generateETag(req) {
  // Generate ETag based on request parameters and timestamp
  const content = JSON.stringify(req.query) + req.user?.id || '';
  return require('crypto').createHash('md5').update(content).digest('hex');
}

module.exports = setCacheHeaders;
```

### 2. CDN/Edge Caching

Configure CDN caching rules:

```javascript
// config/cdn.js
const cdnConfig = {
  // CloudFront configuration
  cloudfront: {
    behaviors: [
      {
        pathPattern: '/api/*',
        cachePolicyId: 'no-cache-policy',
        ttl: {
          default: 0,
          max: 0
        }
      },
      {
        pathPattern: '/static/*',
        cachePolicyId: 'static-assets-policy',
        ttl: {
          default: 86400, // 1 day
          max: 31536000   // 1 year
        }
      },
      {
        pathPattern: '/*',
        cachePolicyId: 'default-policy',
        ttl: {
          default: 3600, // 1 hour
          max: 86400     // 1 day
        }
      }
    ]
  },
  
  // Cache invalidation patterns
  invalidation: {
    paths: [
      '/api/*',
      '/admin/*',
      '/*.html'
    ]
  }
};

module.exports = cdnConfig;
```

### 3. Application-Level Caching

#### In-Memory Caching

```javascript
// utils/memoryCache.js
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }
  
  set(key, value, ttl = this.defaultTTL) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    const expireAt = Date.now() + ttl;
    this.cache.set(key, { value, expireAt });
    this.stats.sets++;
    
    // Set expiration timer
    setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    return true;
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    if (Date.now() > item.expireAt) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return item.value;
  }
  
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }
  
  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }
  
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size
    };
  }
}

module.exports = MemoryCache;
```

#### Redis Caching

```javascript
// utils/redisCache.js
const redis = require('redis');
const logger = require('./logger');

class RedisCache {
  constructor(options = {}) {
    this.client = redis.createClient({
      url: options.url || process.env.REDIS_URL,
      retry_strategy: (times) => Math.min(times * 50, 2000)
    });
    
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes
    this.keyPrefix = options.keyPrefix || 'cache:';
    
    this.client.on('error', (err) => {
      logger.error('Redis cache error', { error: err.message });
    });
    
    this.client.on('connect', () => {
      logger.info('Redis cache connected');
    });
  }
  
  async connect() {
    await this.client.connect();
  }
  
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const serializedValue = JSON.stringify(value);
      const fullKey = this.keyPrefix + key;
      
      if (ttl > 0) {
        await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error('Redis cache set error', { key, error: error.message });
      return false;
    }
  }
  
  async get(key) {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return null;
      }
      
      return JSON.parse(value);
    } catch (error) {
      logger.error('Redis cache get error', { key, error: error.message });
      return null;
    }
  }
  
  async delete(key) {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis cache delete error', { key, error: error.message });
      return false;
    }
  }
  
  async deletePattern(pattern) {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      
      return keys.length;
    } catch (error) {
      logger.error('Redis cache delete pattern error', { pattern, error: error.message });
      return 0;
    }
  }
  
  async increment(key, amount = 1, ttl = this.defaultTTL) {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.incrBy(fullKey, amount);
      
      if (result === amount) {
        // Key was created, set TTL
        await this.client.expire(fullKey, ttl);
      }
      
      return result;
    } catch (error) {
      logger.error('Redis cache increment error', { key, error: error.message });
      return null;
    }
  }
  
  async mget(keys) {
    try {
      const fullKeys = keys.map(key => this.keyPrefix + key);
      const values = await this.client.mGet(fullKeys);
      
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Redis cache mget error', { keys, error: error.message });
      return keys.map(() => null);
    }
  }
}

module.exports = RedisCache;
```

### 4. Database Query Caching

```javascript
// utils/queryCache.js
const RedisCache = require('./redisCache');

class QueryCache {
  constructor(options = {}) {
    this.cache = new RedisCache({
      ...options,
      keyPrefix: 'query:'
    });
    this.defaultTTL = options.queryTTL || 600; // 10 minutes
  }
  
  generateKey(query, params = []) {
    const crypto = require('crypto');
    const content = query + JSON.stringify(params);
    return crypto.createHash('md5').update(content).digest('hex');
  }
  
  async get(query, params = []) {
    const key = this.generateKey(query, params);
    return await this.cache.get(key);
  }
  
  async set(query, params = [], result, ttl = this.defaultTTL) {
    const key = this.generateKey(query, params);
    return await this.cache.set(key, result, ttl);
  }
  
  async invalidateTable(tableName) {
    const pattern = `*${tableName}*`;
    return await this.cache.deletePattern(pattern);
  }
  
  async wrap(query, params = [], executor, ttl = this.defaultTTL) {
    // Try to get from cache first
    let result = await this.get(query, params);
    
    if (result === null) {
      // Execute query and cache result
      result = await executor();
      await this.set(query, params, result, ttl);
    }
    
    return result;
  }
}

module.exports = QueryCache;
```

## Cache Types and Patterns

### 1. Cache-Aside (Lazy Loading)

```javascript
// patterns/cacheAside.js
async function getUserById(id, cache, database) {
  const cacheKey = `user:${id}`;
  
  // Try cache first
  let user = await cache.get(cacheKey);
  
  if (user === null) {
    // Cache miss - fetch from database
    user = await database.query('SELECT * FROM users WHERE id = ?', [id]);
    
    if (user) {
      // Store in cache for future requests
      await cache.set(cacheKey, user, 3600); // 1 hour TTL
    }
  }
  
  return user;
}
```

### 2. Write-Through

```javascript
// patterns/writeThrough.js
async function updateUser(id, userData, cache, database) {
  const cacheKey = `user:${id}`;
  
  // Update database first
  const updatedUser = await database.query(
    'UPDATE users SET ? WHERE id = ? RETURNING *',
    [userData, id]
  );
  
  // Update cache
  await cache.set(cacheKey, updatedUser, 3600);
  
  return updatedUser;
}
```

### 3. Write-Behind (Write-Back)

```javascript
// patterns/writeBehind.js
class WriteBehindCache {
  constructor(cache, database, options = {}) {
    this.cache = cache;
    this.database = database;
    this.writeQueue = new Map();
    this.batchSize = options.batchSize || 100;
    this.writeDelay = options.writeDelay || 5000; // 5 seconds
    
    // Start background writer
    this.startBackgroundWriter();
  }
  
  async set(key, value) {
    // Update cache immediately
    await this.cache.set(key, value);
    
    // Queue for database write
    this.writeQueue.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  startBackgroundWriter() {
    setInterval(async () => {
      await this.flushWrites();
    }, this.writeDelay);
  }
  
  async flushWrites() {
    if (this.writeQueue.size === 0) return;
    
    const writes = Array.from(this.writeQueue.entries()).slice(0, this.batchSize);
    
    try {
      // Batch write to database
      await this.database.transaction(async (trx) => {
        for (const [key, data] of writes) {
          const [table, id] = key.split(':');
          await trx(table).where('id', id).update(data.value);
        }
      });
      
      // Remove successful writes from queue
      writes.forEach(([key]) => this.writeQueue.delete(key));
      
    } catch (error) {
      logger.error('Write-behind flush error', { error: error.message });
    }
  }
}
```

### 4. Read-Through

```javascript
// patterns/readThrough.js
class ReadThroughCache {
  constructor(cache, dataLoader, options = {}) {
    this.cache = cache;
    this.dataLoader = dataLoader;
    this.defaultTTL = options.defaultTTL || 3600;
  }
  
  async get(key) {
    // Try cache first
    let value = await this.cache.get(key);
    
    if (value === null) {
      // Cache miss - load data
      value = await this.dataLoader(key);
      
      if (value !== null) {
        // Store in cache
        await this.cache.set(key, value, this.defaultTTL);
      }
    }
    
    return value;
  }
}

// Usage example
const userCache = new ReadThroughCache(
  redisCache,
  async (userId) => {
    return await database.query('SELECT * FROM users WHERE id = ?', [userId]);
  }
);
```

## Implementation Strategies

### 1. API Response Caching

```javascript
// middleware/responseCache.js
function createResponseCache(cache, options = {}) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey(req);
    
    // Check if response is cached
    const cachedResponse = await cache.get(cacheKey);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Intercept response
    const originalJson = res.json;
    res.json = function(data) {
      // Cache successful responses
      if (res.statusCode === 200) {
        const ttl = options.ttl || 300; // 5 minutes
        cache.set(cacheKey, data, ttl);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

function generateCacheKey(req) {
  const userId = req.user?.id || 'anonymous';
  const path = req.path;
  const query = JSON.stringify(req.query);
  
  return `response:${userId}:${path}:${query}`;
}

module.exports = createResponseCache;
```

### 2. Session Caching

```javascript
// middleware/sessionCache.js
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

function createSessionCache(redisClient) {
  return session({
    store: new RedisStore({
      client: redisClient,
      prefix: 'session:',
      ttl: 24 * 60 * 60 // 24 hours
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  });
}

module.exports = createSessionCache;
```

### 3. Fragment Caching

```javascript
// utils/fragmentCache.js
class FragmentCache {
  constructor(cache) {
    this.cache = cache;
  }
  
  async renderWithCache(template, data, options = {}) {
    const cacheKey = this.generateFragmentKey(template, data, options.keyFields);
    
    // Try to get cached fragment
    let html = await this.cache.get(cacheKey);
    
    if (html === null) {
      // Render template
      html = await this.renderTemplate(template, data);
      
      // Cache rendered HTML
      const ttl = options.ttl || 1800; // 30 minutes
      await this.cache.set(cacheKey, html, ttl);
    }
    
    return html;
  }
  
  generateFragmentKey(template, data, keyFields = []) {
    const templateName = template.replace(/[^a-zA-Z0-9]/g, '_');
    const keyData = keyFields.length > 0 
      ? keyFields.map(field => data[field]).join(':')
      : JSON.stringify(data);
    
    return `fragment:${templateName}:${keyData}`;
  }
  
  async renderTemplate(template, data) {
    // Implementation depends on your template engine
    // Example with handlebars:
    const handlebars = require('handlebars');
    const templateSource = await fs.readFile(template, 'utf8');
    const compiledTemplate = handlebars.compile(templateSource);
    return compiledTemplate(data);
  }
}

module.exports = FragmentCache;
```

## Cache Invalidation

### 1. Time-Based Invalidation (TTL)

```javascript
// strategies/ttlInvalidation.js
class TTLInvalidation {
  constructor(cache) {
    this.cache = cache;
  }
  
  // Set different TTLs based on data type
  getTTL(dataType, operation = 'read') {
    const ttlMap = {
      'user-profile': {
        read: 3600,    // 1 hour
        write: 300     // 5 minutes after update
      },
      'product-catalog': {
        read: 7200,    // 2 hours
        write: 600     // 10 minutes after update
      },
      'session-data': {
        read: 1800,    // 30 minutes
        write: 1800
      },
      'analytics': {
        read: 300,     // 5 minutes
        write: 60      // 1 minute after update
      }
    };
    
    return ttlMap[dataType]?.[operation] || 300; // Default 5 minutes
  }
  
  async setWithTTL(key, value, dataType, operation = 'read') {
    const ttl = this.getTTL(dataType, operation);
    return await this.cache.set(key, value, ttl);
  }
}
```

### 2. Event-Based Invalidation

```javascript
// strategies/eventInvalidation.js
const EventEmitter = require('events');

class EventBasedInvalidation extends EventEmitter {
  constructor(cache) {
    super();
    this.cache = cache;
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.on('user.updated', async (userId) => {
      await this.invalidateUserData(userId);
    });
    
    this.on('product.updated', async (productId) => {
      await this.invalidateProductData(productId);
    });
    
    this.on('order.created', async (userId, productIds) => {
      await this.invalidateUserData(userId);
      await this.invalidateAnalytics();
    });
  }
  
  async invalidateUserData(userId) {
    const patterns = [
      `user:${userId}`,
      `user:${userId}:*`,
      `response:${userId}:*`
    ];
    
    for (const pattern of patterns) {
      await this.cache.deletePattern(pattern);
    }
  }
  
  async invalidateProductData(productId) {
    const patterns = [
      `product:${productId}`,
      `product:${productId}:*`,
      'product-catalog:*',
      'response:*/api/products*'
    ];
    
    for (const pattern of patterns) {
      await this.cache.deletePattern(pattern);
    }
  }
  
  async invalidateAnalytics() {
    await this.cache.deletePattern('analytics:*');
  }
}
```

### 3. Tag-Based Invalidation

```javascript
// strategies/tagInvalidation.js
class TagBasedInvalidation {
  constructor(cache) {
    this.cache = cache;
    this.tagCache = cache; // Could be separate cache instance
  }
  
  async setWithTags(key, value, tags = [], ttl = 300) {
    // Store the main data
    await this.cache.set(key, value, ttl);
    
    // Associate key with tags
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      let taggedKeys = await this.tagCache.get(tagKey) || [];
      
      if (!taggedKeys.includes(key)) {
        taggedKeys.push(key);
        await this.tagCache.set(tagKey, taggedKeys, ttl);
      }
    }
  }
  
  async invalidateByTag(tag) {
    const tagKey = `tag:${tag}`;
    const taggedKeys = await this.tagCache.get(tagKey) || [];
    
    // Delete all keys associated with this tag
    const deletePromises = taggedKeys.map(key => this.cache.delete(key));
    await Promise.all(deletePromises);
    
    // Clear the tag
    await this.tagCache.delete(tagKey);
    
    return taggedKeys.length;
  }
  
  async invalidateByTags(tags) {
    const results = await Promise.all(
      tags.map(tag => this.invalidateByTag(tag))
    );
    
    return results.reduce((sum, count) => sum + count, 0);
  }
}

// Usage example
const tagCache = new TagBasedInvalidation(redisCache);

// Cache user data with tags
await tagCache.setWithTags(
  'user:123',
  userData,
  ['user', 'profile', 'user-123'],
  3600
);

// Invalidate all user-related data
await tagCache.invalidateByTag('user');
```

## Performance Considerations

### 1. Cache Hit Ratio Optimization

```javascript
// monitoring/cacheMetrics.js
class CacheMetrics {
  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }
  
  recordHit() {
    this.metrics.hits++;
  }
  
  recordMiss() {
    this.metrics.misses++;
  }
  
  recordSet() {
    this.metrics.sets++;
  }
  
  recordDelete() {
    this.metrics.deletes++;
  }
  
  recordError() {
    this.metrics.errors++;
  }
  
  getHitRatio() {
    const total = this.metrics.hits + this.metrics.misses;
    return total > 0 ? this.metrics.hits / total : 0;
  }
  
  getStats() {
    return {
      ...this.metrics,
      hitRatio: this.getHitRatio(),
      total: this.metrics.hits + this.metrics.misses
    };
  }
  
  reset() {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }
}
```

### 2. Cache Warming

```javascript
// strategies/cacheWarming.js
class CacheWarming {
  constructor(cache, dataLoader) {
    this.cache = cache;
    this.dataLoader = dataLoader;
  }
  
  async warmCache(keys, batchSize = 10) {
    const batches = this.chunkArray(keys, batchSize);
    
    for (const batch of batches) {
      await Promise.all(batch.map(key => this.warmKey(key)));
    }
  }
  
  async warmKey(key) {
    try {
      // Check if already cached
      const cached = await this.cache.get(key);
      if (cached !== null) {
        return; // Already warm
      }
      
      // Load and cache data
      const data = await this.dataLoader(key);
      if (data !== null) {
        await this.cache.set(key, data);
      }
    } catch (error) {
      logger.error('Cache warming error', { key, error: error.message });
    }
  }
  
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  // Warm frequently accessed data
  async warmFrequentData() {
    const popularUsers = await this.getPopularUsers();
    const popularProducts = await this.getPopularProducts();
    
    await this.warmCache(
      popularUsers.map(user => `user:${user.id}`)
    );
    
    await this.warmCache(
      popularProducts.map(product => `product:${product.id}`)
    );
  }
}
```

### 3. Cache Compression

```javascript
// utils/cacheCompression.js
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class CompressedCache {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.compressionLevel = options.compressionLevel || 6;
  }
  
  async set(key, value, ttl) {
    let serialized = JSON.stringify(value);
    let compressed = false;
    
    // Compress if data is large enough
    if (serialized.length > this.compressionThreshold) {
      try {
        const buffer = await gzip(serialized, { level: this.compressionLevel });
        serialized = buffer.toString('base64');
        compressed = true;
      } catch (error) {
        logger.warn('Compression failed, storing uncompressed', { 
          key, 
          error: error.message 
        });
      }
    }
    
    const cacheValue = {
      data: serialized,
      compressed
    };
    
    return await this.cache.set(key, cacheValue, ttl);
  }
  
  async get(key) {
    const cacheValue = await this.cache.get(key);
    
    if (!cacheValue) {
      return null;
    }
    
    let data = cacheValue.data;
    
    // Decompress if needed
    if (cacheValue.compressed) {
      try {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = decompressed.toString();
      } catch (error) {
        logger.error('Decompression failed', { key, error: error.message });
        return null;
      }
    }
    
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('JSON parse failed', { key, error: error.message });
      return null;
    }
  }
}
```

## Security Considerations

### 1. Cache Security

```javascript
// security/cacheSecurityDefaults.js
class SecureCache {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.encryptionKey = options.encryptionKey || process.env.CACHE_ENCRYPTION_KEY;
    this.hashSensitiveKeys = options.hashSensitiveKeys !== false;
  }
  
  async set(key, value, ttl, options = {}) {
    // Hash sensitive keys
    const secureKey = this.secureKey(key, options.sensitive);
    
    // Encrypt sensitive data
    const secureValue = options.sensitive 
      ? await this.encrypt(value)
      : value;
    
    return await this.cache.set(secureKey, secureValue, ttl);
  }
  
  async get(key, options = {}) {
    const secureKey = this.secureKey(key, options.sensitive);
    const value = await this.cache.get(secureKey);
    
    if (value === null) {
      return null;
    }
    
    // Decrypt if needed
    return options.sensitive 
      ? await this.decrypt(value)
      : value;
  }
  
  secureKey(key, sensitive = false) {
    if (!sensitive || !this.hashSensitiveKeys) {
      return key;
    }
    
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }
  
  async encrypt(data) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key required for sensitive data');
    }
    
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }
  
  async decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key required for sensitive data');
    }
    
    const crypto = require('crypto');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}
```

### 2. Access Control

```javascript
// security/cacheAccessControl.js
class CacheAccessControl {
  constructor(cache) {
    this.cache = cache;
  }
  
  async set(key, value, ttl, context = {}) {
    // Validate user permissions
    if (!this.canWrite(key, context.user)) {
      throw new Error('Write access denied');
    }
    
    // Add access metadata
    const secureValue = {
      data: value,
      owner: context.user?.id,
      timestamp: Date.now(),
      permissions: context.permissions || []
    };
    
    return await this.cache.set(key, secureValue, ttl);
  }
  
  async get(key, context = {}) {
    const cacheValue = await this.cache.get(key);
    
    if (!cacheValue) {
      return null;
    }
    
    // Check read permissions
    if (!this.canRead(key, cacheValue, context.user)) {
      throw new Error('Read access denied');
    }
    
    return cacheValue.data;
  }
  
  canRead(key, cacheValue, user) {
    // Public data
    if (!cacheValue.owner) {
      return true;
    }
    
    // Owner access
    if (user?.id === cacheValue.owner) {
      return true;
    }
    
    // Permission-based access
    const userPermissions = user?.permissions || [];
    const requiredPermissions = cacheValue.permissions || [];
    
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );
  }
  
  canWrite(key, user) {
    // Implement write permission logic
    if (!user) {
      return false;
    }
    
    // Admin users can write anywhere
    if (user.role === 'admin') {
      return true;
    }
    
    // Users can only write to their own data
    return key.includes(`user:${user.id}`);
  }
}
```

## Best Practices

### 1. Cache Configuration Standards

```javascript
// config/cacheConfig.js
const cacheConfig = {
  // Environment-specific settings
  development: {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0
    },
    defaultTTL: 300,
    compressionThreshold: 1024
  },
  
  production: {
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      tls: true
    },
    defaultTTL: 3600,
    compressionThreshold: 512,
    maxMemoryPolicy: 'allkeys-lru'
  },
  
  // Cache TTL guidelines
  ttlPresets: {
    'static-content': 86400,    // 24 hours
    'user-session': 3600,       // 1 hour
    'api-response': 300,        // 5 minutes
    'database-query': 600,      // 10 minutes
    'analytics': 1800,          // 30 minutes
    'temporary': 60             // 1 minute
  },
  
  // Key naming conventions
  keyPrefixes: {
    user: 'user:',
    session: 'session:',
    api: 'api:',
    query: 'query:',
    fragment: 'fragment:'
  }
};

module.exports = cacheConfig;
```

### 2. Cache Monitoring

```javascript
// monitoring/cacheMonitoring.js
const prometheus = require('prom-client');

// Cache metrics
const cacheHits = new prometheus.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type', 'key_pattern']
});

const cacheMisses = new prometheus.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type', 'key_pattern']
});

const cacheSize = new prometheus.Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type']
});

const cacheOperationDuration = new prometheus.Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Cache operation duration',
  labelNames: ['operation', 'cache_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

class CacheMonitor {
  constructor(cache, cacheType = 'default') {
    this.cache = cache;
    this.cacheType = cacheType;
  }
  
  async monitoredGet(key) {
    const start = Date.now();
    const keyPattern = this.getKeyPattern(key);
    
    try {
      const value = await this.cache.get(key);
      
      if (value !== null) {
        cacheHits.labels(this.cacheType, keyPattern).inc();
      } else {
        cacheMisses.labels(this.cacheType, keyPattern).inc();
      }
      
      return value;
    } finally {
      const duration = (Date.now() - start) / 1000;
      cacheOperationDuration
        .labels('get', this.cacheType)
        .observe(duration);
    }
  }
  
  async monitoredSet(key, value, ttl) {
    const start = Date.now();
    
    try {
      return await this.cache.set(key, value, ttl);
    } finally {
      const duration = (Date.now() - start) / 1000;
      cacheOperationDuration
        .labels('set', this.cacheType)
        .observe(duration);
    }
  }
  
  getKeyPattern(key) {
    // Extract pattern from key (e.g., "user:123" -> "user:*")
    const parts = key.split(':');
    if (parts.length > 1) {
      return parts[0] + ':*';
    }
    return 'other';
  }
}

module.exports = CacheMonitor;
```

## Troubleshooting

### Common Cache Issues

#### 1. Cache Stampede

```javascript
// solutions/cacheStampede.js
class StampedeProtection {
  constructor(cache) {
    this.cache = cache;
    this.pendingRequests = new Map();
  }
  
  async getWithStampedeProtection(key, loader, ttl = 300) {
    // Check if request is already pending
    if (this.pendingRequests.has(key)) {
      return await this.pendingRequests.get(key);
    }
    
    // Try cache first
    let value = await this.cache.get(key);
    
    if (value === null) {
      // Create pending promise
      const promise = this.loadAndCache(key, loader, ttl);
      this.pendingRequests.set(key, promise);
      
      try {
        value = await promise;
      } finally {
        this.pendingRequests.delete(key);
      }
    }
    
    return value;
  }
  
  async loadAndCache(key, loader, ttl) {
    const value = await loader();
    
    if (value !== null) {
      await this.cache.set(key, value, ttl);
    }
    
    return value;
  }
}
```

#### 2. Memory Leaks

```javascript
// solutions/memoryLeak.js
class MemoryLeakPrevention {
  constructor(cache, options = {}) {
    this.cache = cache;
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    
    this.startCleanupScheduler();
  }
  
  startCleanupScheduler() {
    setInterval(() => {
      this.cleanupExpiredKeys();
      this.checkMemoryUsage();
    }, this.cleanupInterval);
  }
  
  async cleanupExpiredKeys() {
    const stats = this.cache.getStats();
    
    if (stats.size > 1000) { // Cleanup when cache is large
      const keys = await this.cache.keys('*');
      const expiredKeys = [];
      
      for (const key of keys) {
        const ttl = await this.cache.ttl(key);
        if (ttl === -1) { // No expiration set
          expiredKeys.push(key);
        }
      }
      
      // Remove keys without TTL (potential leaks)
      if (expiredKeys.length > 0) {
        await this.cache.del(expiredKeys);
        logger.info('Cleaned up expired keys', { count: expiredKeys.length });
      }
    }
  }
  
  checkMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    
    if (memoryUsage.heapUsed > this.maxMemory) {
      logger.warn('High memory usage detected', {
        heapUsed: memoryUsage.heapUsed,
        maxMemory: this.maxMemory
      });
      
      // Trigger aggressive cleanup
      this.cache.flushall();
    }
  }
}
```

#### 3. Cache Performance Issues

```javascript
// solutions/performanceOptimization.js
class CachePerformanceOptimizer {
  constructor(cache) {
    this.cache = cache;
    this.slowQueries = new Map();
  }
  
  async optimizedGet(key, loader, options = {}) {
    const start = Date.now();
    
    try {
      // Use pipeline for multiple operations
      if (Array.isArray(key)) {
        return await this.batchGet(key, loader);
      }
      
      // Single key operation
      return await this.cache.get(key);
      
    } finally {
      const duration = Date.now() - start;
      
      // Track slow operations
      if (duration > 100) { // 100ms threshold
        this.recordSlowQuery(key, duration);
      }
    }
  }
  
  async batchGet(keys, loader) {
    // Get all values in parallel
    const values = await this.cache.mget(keys);
    const missingKeys = [];
    const result = {};
    
    // Identify missing keys
    keys.forEach((key, index) => {
      if (values[index] === null) {
        missingKeys.push(key);
      } else {
        result[key] = values[index];
      }
    });
    
    // Load missing values
    if (missingKeys.length > 0 && loader) {
      const missingValues = await loader(missingKeys);
      Object.assign(result, missingValues);
      
      // Cache missing values
      const pipeline = this.cache.pipeline();
      Object.entries(missingValues).forEach(([key, value]) => {
        pipeline.set(key, value, 300);
      });
      await pipeline.exec();
    }
    
    return result;
  }
  
  recordSlowQuery(key, duration) {
    const pattern = this.getKeyPattern(key);
    
    if (!this.slowQueries.has(pattern)) {
      this.slowQueries.set(pattern, {
        count: 0,
        totalDuration: 0,
        maxDuration: 0
      });
    }
    
    const stats = this.slowQueries.get(pattern);
    stats.count++;
    stats.totalDuration += duration;
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    
    // Log if pattern becomes frequent
    if (stats.count % 10 === 0) {
      logger.warn('Slow cache operations detected', {
        pattern,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
        maxDuration: stats.maxDuration
      });
    }
  }
}
```

This comprehensive caching strategies document provides a complete framework for implementing efficient,
secure, and maintainable caching solutions in REST-Base applications.
