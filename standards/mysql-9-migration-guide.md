# MySQL 9.0 Migration Guide

## Table of Contents

- [Overview](#overview)
- [Pre-Migration Checklist](#pre-migration-checklist)
- [Known Breaking Changes](#known-breaking-changes)
- [Step-by-Step Migration Process](#step-by-step-migration-process)
- [Testing Procedures](#testing-procedures)
- [Rollback Procedure](#rollback-procedure)
- [Post-Migration Monitoring](#post-migration-monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

This guide provides detailed instructions for migrating from MySQL 8.0/8.4 to MySQL 9.0.1+ or from earlier
versions to MySQL 8.4 LTS. MySQL 9.0 introduces important changes, particularly around authentication and
collation behavior.

### Version Recommendations

- **Production**: MySQL 8.4 LTS (supported until April 2032)
- **Development/Testing**: MySQL 9.0.1+ (innovation release with latest features)
- **Avoid**: MySQL 9.0.0 (removed from distribution due to critical bugs)

## Pre-Migration Checklist

### 1. Environment Assessment

- [ ] Identify current MySQL version: `SELECT VERSION();`
- [ ] Document all databases and schemas
- [ ] Review current storage engine usage: `SHOW TABLE STATUS;`
- [ ] Check current charset/collation: `SHOW VARIABLES LIKE '%char%';`
- [ ] Identify custom stored procedures and functions
- [ ] Review application connection strings and configurations

### 2. Dependency Updates

Update Node.js dependencies before migration:

```bash
# Update mysql2 driver
npm install mysql2@^3.11.5

# Update Sequelize ORM
npm install sequelize@^6.37.5

# Verify installations
npm list mysql2 sequelize
```

### 3. Code Preparation

- [ ] Add string trimming to all Sequelize models (see User.js example)
- [ ] Update database.js configuration with new dialectOptions
- [ ] Review all raw SQL queries for compatibility
- [ ] Update Docker configurations to mysql:9.0.1 or mysql:8.4

### 4. Backup Strategy

**Critical: Always backup before migration**

```bash
# Full database backup
mysqldump -u root -p --all-databases --single-transaction --routines --triggers > backup_$(date +%Y%m%d_%H%M%S).sql

# Specific database backup
mysqldump -u root -p your_database_name > your_database_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

### 5. Test Environment Setup

- [ ] Create staging environment with MySQL 9.0.1
- [ ] Restore backup to staging
- [ ] Run full test suite on staging
- [ ] Perform load testing
- [ ] Monitor for deprecation warnings

## Known Breaking Changes

### 1. Authentication Method Removal

**Issue**: MySQL 9.0 has removed `mysql_native_password` authentication plugin.

**Impact**:

- Older clients that only support mysql_native_password cannot connect
- Connection strings may need updating
- User accounts created with old auth method won't work

**Solution**:

```javascript
// Update database.js configuration
dialectOptions: {
  authPlugins: {
    caching_sha2_password: () => () => Buffer.from([]);
  }
}
```

**MySQL User Update**:

```sql
-- Update existing user to use caching_sha2_password
ALTER USER 'app_user'@'%' IDENTIFIED WITH caching_sha2_password BY 'password';
FLUSH PRIVILEGES;
```

### 2. NO PAD Collation Behavior

**Issue**: utf8mb4_0900_ai_ci is a NO PAD collation - trailing spaces are significant.

**Impact**:

- `'value'` and `'value '` are treated as different strings
- GROUP BY creates separate groups for strings with different trailing spaces
- UNIQUE constraints allow both values
- WHERE clauses require exact spacing

**Solution**: Add automatic trimming to all string fields

```javascript
// In Sequelize models
email: {
  type: DataTypes.STRING,
  set(value) {
    this.setDataValue('email', value ? value.trim() : value);
  }
}
```

**Data Cleanup**:

```sql
-- Find records with trailing spaces
SELECT id, email, LENGTH(email) - LENGTH(TRIM(email)) AS trailing_spaces
FROM users
WHERE email != TRIM(email);

-- Clean up trailing spaces (backup first!)
UPDATE users SET email = TRIM(email) WHERE email != TRIM(email);
UPDATE users SET firstName = TRIM(firstName) WHERE firstName != TRIM(firstName);
UPDATE users SET lastName = TRIM(lastName) WHERE lastName != TRIM(lastName);
```

### 3. Mixed Transaction Types Deprecated

**Issue**: Transactions mixing InnoDB and MyISAM tables generate warnings.

**Impact**: Minimal - this project uses InnoDB exclusively.

**Action**: Verify all tables use InnoDB:

```sql
-- Check for non-InnoDB tables
SELECT TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
AND ENGINE != 'InnoDB';

-- Convert to InnoDB if needed
ALTER TABLE table_name ENGINE=InnoDB;
```

## Step-by-Step Migration Process

### Option 1: In-Place Upgrade (Development)

**Use for**: Development and staging environments

1. **Stop Application Services**

   ```bash
   # If using PM2
   pm2 stop all

   # If using Docker
   docker-compose down
   ```

2. **Backup Current Database**

   ```bash
   mysqldump -u root -p --all-databases > pre_upgrade_backup.sql
   ```

3. **Stop MySQL Service**

   ```bash
   # Ubuntu/Debian
   sudo systemctl stop mysql

   # macOS (Homebrew)
   brew services stop mysql
   ```

4. **Upgrade MySQL**

   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install mysql-server-9.0

   # macOS (Homebrew)
   brew upgrade mysql
   ```

5. **Run MySQL Upgrade Utility**

   ```bash
   sudo mysql_upgrade -u root -p
   ```

6. **Start MySQL Service**

   ```bash
   # Ubuntu/Debian
   sudo systemctl start mysql

   # macOS (Homebrew)
   brew services start mysql
   ```

7. **Verify Upgrade**

   ```bash
   mysql -u root -p -e "SELECT VERSION();"
   ```

### Option 2: Docker Migration (Recommended)

**Use for**: All environments, especially production

1. **Update docker-compose.yml**

   ```yaml
   mysql:
     image: mysql:9.0.1
     environment:
       - MYSQL_DATABASE=your_db
       - MYSQL_USER=app_user
       - MYSQL_PASSWORD=password
       - MYSQL_ROOT_PASSWORD=root_password
   ```

2. **Export Data from Old Container**

   ```bash
   # Export data
   docker exec mysql mysqldump -u root -proot_password --all-databases > backup.sql

   # Stop and remove old container
   docker-compose down
   docker volume rm project_mysql_data  # WARNING: This deletes data!
   ```

3. **Start New MySQL 9.0.1 Container**

   ```bash
   docker-compose up -d mysql
   ```

4. **Import Data**

   ```bash
   # Wait for MySQL to be ready
   docker-compose logs -f mysql

   # Import backup
   docker exec -i mysql mysql -u root -proot_password < backup.sql
   ```

5. **Verify Import**

   ```bash
   docker exec mysql mysql -u root -proot_password -e "SHOW DATABASES;"
   ```

### Option 3: Production Blue-Green Deployment

**Use for**: Zero-downtime production migration

1. **Set Up Parallel MySQL 9.0 Instance**
2. **Configure Replication from MySQL 8.x to MySQL 9.0**
3. **Monitor Replication Lag**
4. **Switch Application Connection String**
5. **Monitor for Issues**
6. **Decommission Old Instance After 24-48 Hours**

## Testing Procedures

### 1. Connection Testing

```javascript
// Test database connection
const { Sequelize } = require("sequelize");
const config = require("./src/config/database");

async function testConnection() {
  const sequelize = new Sequelize(config.development);

  try {
    await sequelize.authenticate();
    console.log("✓ Connection successful");

    const [results] = await sequelize.query("SELECT VERSION() as version");
    console.log("✓ MySQL version:", results[0].version);

    await sequelize.close();
  } catch (error) {
    console.error("✗ Connection failed:", error);
  }
}

testConnection();
```

### 2. Authentication Testing

```bash
# Test connection with different auth methods
mysql -u app_user -p -h localhost -e "SELECT USER(), CURRENT_USER();"

# Check auth plugin
mysql -u root -p -e "SELECT user, host, plugin FROM mysql.user WHERE user='app_user';"
```

### 3. Data Integrity Testing

```sql
-- Verify record counts
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM teams;

-- Check for trailing spaces
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN email != TRIM(email) THEN 1 ELSE 0 END) as with_trailing_spaces
FROM users;

-- Test GROUP BY behavior
SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) > 1;
```

### 4. Application Testing

```bash
# Run full test suite
npm test

# Run integration tests
npm run test:integration

# Test specific features
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=database
```

### 5. Performance Testing

```bash
# Run benchmarks
npm run benchmark

# Monitor query performance
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

# Review slow query log
sudo tail -f /var/log/mysql/mysql-slow.log
```

## Rollback Procedure

### If Migration Fails

1. **Stop Application**

   ```bash
   pm2 stop all
   # or
   docker-compose down
   ```

2. **Stop MySQL 9.0**

   ```bash
   sudo systemctl stop mysql
   # or keep Docker down
   ```

3. **Restore Backup**

   **For Traditional Installation:**

   ```bash
   # Reinstall MySQL 8.4
   sudo apt install mysql-server-8.4

   # Restore backup
   mysql -u root -p < pre_upgrade_backup.sql
   ```

   **For Docker:**

   ```bash
   # Revert docker-compose.yml to mysql:8.4

   # Remove MySQL 9.0 volume
   docker volume rm project_mysql_data

   # Restore from backup
   docker-compose up -d mysql
   docker exec -i mysql mysql -u root -proot_password < pre_upgrade_backup.sql
   ```

4. **Revert Code Changes**

   ```bash
   git revert <commit-hash>
   # or
   git checkout previous-branch
   ```

5. **Verify Rollback**

   ```bash
   mysql -e "SELECT VERSION();"
   npm test
   ```

## Post-Migration Monitoring

### 1. Error Log Monitoring

```bash
# MySQL error log
sudo tail -f /var/log/mysql/error.log

# Application logs
pm2 logs
# or
docker-compose logs -f app
```

### 2. Performance Monitoring

```sql
-- Monitor slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;

-- Check connection stats
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';

-- Monitor query cache (if enabled)
SHOW STATUS LIKE 'Qcache%';
```

### 3. Deprecation Warnings

```sql
-- Check for deprecation warnings
SHOW WARNINGS;

-- Review error log for warnings
SELECT * FROM performance_schema.error_log
WHERE error_code = 'MY-013360'
ORDER BY logged DESC LIMIT 20;
```

### 4. Application Health Checks

```bash
# Health endpoint
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/db

# Run smoke tests
npm run test:smoke
```

## Troubleshooting

### Issue: Connection Refused

**Symptom**: Application cannot connect to MySQL

**Solutions**:

```bash
# 1. Verify MySQL is running
systemctl status mysql
docker-compose ps

# 2. Check MySQL logs
sudo tail -f /var/log/mysql/error.log
docker-compose logs mysql

# 3. Verify port binding
netstat -tlnp | grep 3306
docker port mysql_container 3306

# 4. Test connection manually
mysql -u root -p -h localhost
```

### Issue: Authentication Errors

**Symptom**: Access denied for user 'app_user'@'host'

**Solutions**:

```sql
-- 1. Check user exists and auth method
SELECT user, host, plugin FROM mysql.user WHERE user='app_user';

-- 2. Update to caching_sha2_password
ALTER USER 'app_user'@'%' IDENTIFIED WITH caching_sha2_password BY 'password';
FLUSH PRIVILEGES;

-- 3. Grant necessary permissions
GRANT ALL PRIVILEGES ON database_name.* TO 'app_user'@'%';
FLUSH PRIVILEGES;
```

### Issue: Character Set Errors

**Symptom**: Incorrect string value or character set errors

**Solutions**:

```sql
-- 1. Check database charset
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'your_database';

-- 2. Update database charset
ALTER DATABASE your_database
CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- 3. Update table charset
ALTER TABLE table_name
CONVERT TO CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;
```

### Issue: GROUP BY Returns Different Results

**Symptom**: GROUP BY queries return unexpected number of groups

**Solutions**:

```sql
-- 1. Check for trailing spaces
SELECT column_name, HEX(column_name)
FROM table_name
WHERE column_name != TRIM(column_name);

-- 2. Clean up data
UPDATE table_name SET column_name = TRIM(column_name);

-- 3. Add TRIM to queries temporarily
SELECT TRIM(column_name), COUNT(*)
FROM table_name
GROUP BY TRIM(column_name);
```

### Issue: Sequelize Connection Errors

**Symptom**: Sequelize throws authentication or connection errors

**Solutions**:

1. **Update Dependencies**

   ```bash
   npm install mysql2@latest sequelize@latest
   ```

2. **Update Configuration**

   ```javascript
   // database.js
   dialectOptions: {
     authPlugins: {
       caching_sha2_password: () => () => Buffer.from([])
     },
     charset: 'utf8mb4',
     collate: 'utf8mb4_0900_ai_ci'
   }
   ```

3. **Test Connection**

   ```javascript
   await sequelize.authenticate();
   console.log("Connection successful");
   ```

## Additional Resources

### Documentation

- [MySQL 9.0 Release Notes](https://dev.mysql.com/doc/relnotes/mysql/9.0/en/)
- [MySQL 9.0 Reference Manual](https://dev.mysql.com/doc/refman/9.0/en/)
- [Sequelize MySQL Dialect](https://sequelize.org/docs/v6/other-topics/dialect-specific-things/)
- [mysql2 Documentation](https://github.com/sidorares/node-mysql2)

### Internal Documentation

- [sql-standards-and-patterns.md](./sql-standards-and-patterns.md) - SQL coding standards
- [technologies.md](./technologies.md) - Technology stack requirements
- [deployment-procedures.md](./deployment-procedures.md) - Deployment guidelines

### Support

- GitHub Issues: [Report migration issues](https://github.com/karlgroves/rest-base/issues)
- MySQL Community: [MySQL Forums](https://forums.mysql.com/)

## Checklist Summary

### Pre-Migration

- [ ] Full database backup completed
- [ ] Dependencies updated (mysql2, sequelize)
- [ ] Code changes implemented (trimming, config)
- [ ] Docker configurations updated
- [ ] Test environment validated
- [ ] Rollback procedure documented

### Migration

- [ ] Application stopped
- [ ] MySQL upgraded/migrated
- [ ] Users updated to caching_sha2_password
- [ ] Data imported/verified
- [ ] Application restarted
- [ ] Smoke tests passed

### Post-Migration

- [ ] Connection tests passed
- [ ] Full test suite passed
- [ ] Performance benchmarks acceptable
- [ ] No deprecation warnings
- [ ] Monitoring dashboards updated
- [ ] Team notified of migration
- [ ] Documentation updated

---

**Last Updated**: 2025-10-03
**Applies To**: MySQL 9.0.1+, MySQL 8.4 LTS
**Maintained By**: REST-SPEC Project
