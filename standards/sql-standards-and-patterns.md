# SQL Standards and Design Patterns

## Introduction

All database development for this system is built for MySQL/MariaDB, but should strive for cross-database
compatibility when practical. SQL used in the application should adhere to standard SQL syntax where possible,
balancing MySQL's specific features with broader compatibility. Where MySQL doesn't support the standard,
the MySQL-specific approach should be used. When writing SQL, aim for compatibility with:

1. MySQL/MariaDB (primary)
2. PostgreSQL
3. Oracle
4. SQLite

This document outlines our SQL design patterns, naming conventions, and best practices for use with Node.js applications.

## Table Structures

1. All MySQL databases should use InnoDB as the engine
2. All MySQL databases should use `DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci`;
3. All MySQL databases should have a column, `inc` set to be an auto incrementing integer.
   This should be an index, but MUST NOT be used as a referenceable primary key.
   It is rather used to help MySQL indexing.

## Table Naming Conventions

1. **CamelCase for Table Names**: Tables are named using camelCase (e.g., `refreshTokens`, `teamMembers`, `passwordResetHashes`).
2. **Plural Form**: Table names should be in plural form (e.g., `users`, `teams`, `logs`).
3. **Descriptive Names**: Table names must clearly indicate the entity they represent (e.g., `passwordResetHashes`, `userPermissions`).
4. **Avoid Reserved Words**: Never use SQL reserved words for table names.

## Column Naming Conventions

1. **CamelCase for Column Names**: All column names use camelCase (e.g., `userId`, `tokenHash`, `permissionId`).
2. **Primary Keys**:
   - `inc`: MUST NOT be used as an auto-incrementing integer primary key in most tables.
   - Entity-specific IDs: All tables MUST have a UUID-based identifier (e.g., `userId`, `teamId`, `logId`).

3. **Common Columns**:
   - `created`: Timestamp column with default `CURRENT_TIMESTAMP`.
   - `updated`: Timestamp column with default `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`.
   - Entity-related IDs: Foreign key columns typically named as `entityId` (e.g., `userId`, `teamId`).

4. **Boolean Columns**: Use `ENUM('0', '1')` with default `'0'` rather than MySQL's BOOLEAN type (e.g., `confirmed`, `isBanned`).

## SQL Keywords and Formatting

### SQL Keywords Must Be Capitalized

When writing SQL queries, capitalize all SQL keywords (SELECT, FROM, VALUES, AS, etc.) and leave everything
else in the relevant case. WHERE clauses should be grouped by parentheses if they get too complex.

### SQL Formatting & Indentation

SQL queries should be formatted for readability, with each clause on a new line and appropriate indentation. For example:

```sql
SELECT
    t1.column_a,
    t2.column_b
FROM
    table1 t1,
    table2 t2
WHERE
    some_condition
    AND
    some_other_condition
```

### Use Standard SQL Operators

Use standard SQL operators for better cross-database compatibility:

- Use `<>` for "not equals" instead of `!=`
- Avoid MySQL-specific syntax like backticks (`) to enclose identifiers
- Use standard SQL functions when available

## Database Design Patterns

### ID Strategies

1. **Auto-incrementing integers** for primary keys: `MEDIUMINT UNSIGNED NOT NULL AUTO_INCREMENT`.
2. **UUID strings** (36 characters) for entity identifiers: `VARCHAR(36) NOT NULL`.

### Relationship Patterns

1. **Many-to-Many**: Implemented using junction tables (e.g., `userPermissions` connecting `users` and `permissions`).
2. **One-to-Many**: Implemented using foreign keys (e.g., `teams` to `teamMembers`).

### Index Patterns

1. Primary keys on UUID columns (e.g., `userId`, `teamId`).
2. Indexes on `inc` columns.
3. Indexes on frequently searched string columns (e.g., `event` in `logs` table).
4. Indexes on foreign key columns.

### Data Types

1. `VARCHAR(36)` for UUID identifiers.
2. `VARCHAR(255)` for names and short descriptions.
3. `TEXT` for longer text fields.
4. `JSON` for structured data (e.g., `metadata`, `permissions`).
5. `ENUM` for fields with a fixed set of possible values (e.g., roles, boolean flags).
6. `DATETIME` for timestamp fields.
7. `MEDIUMINT UNSIGNED` for auto-increment IDs.

### Constraints

1. Foreign Key constraints with `ON DELETE CASCADE ON UPDATE CASCADE`.
2. Unique constraints on fields that should be unique (e.g., permission names).

## SQL Query Best Practices

### Limit Results

Always include a LIMIT clause in your queries, even when you expect only one record to be returned:

```sql
SELECT
    *
FROM
    users
WHERE
    id = ?
LIMIT
    1
```

Limiting queries tells the database to stop looking for more records once the limit is reached, which can improve performance significantly for large tables.

### Parameterize Queries

When using SQL in Node.js applications, always use parameterized queries to prevent SQL injection. Never concatenate user input directly into SQL strings.

**Bad Example (vulnerable to SQL injection):**

```javascript
// DON'T DO THIS
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
db.query(query);
```

**Good Example (using parameterized queries):**

```javascript
// DO THIS INSTEAD
const query = "SELECT * FROM users WHERE id = ?";
db.query(query, [req.params.id]);
```

With MySQL in Node.js, use the `?` placeholder syntax for parameter substitution, or named parameters with libraries that support them.

### Store Queries in Variables

For complex queries, assign them to variables for better debugging and readability:

```javascript
// Define the query separately
const query = `
    SELECT 
        u.name,
        u.email,
        t.name AS teamName
    FROM
        users u
    JOIN
        teamMembers tm ON u.id = tm.userId
    JOIN
        teams t ON tm.teamId = t.id
    WHERE
        u.id = ?
`;

// Execute the query
try {
  const user = await db.query(query, [userId]);
  // Process results
} catch (error) {
  console.error("Query error:", error);
  console.log("Failed query:", query); // Helpful for debugging
}
```

## Migration Patterns

### Migration Naming

1. Timestamp-prefixed names (e.g., `20230714112440-add-refresh-tokens-up.sql`).
2. Clear description of the change (e.g., `add-refresh-tokens`, `introduce-permissions`).
3. Suffix indicating migration direction (`up` or `down`).

### Migration Types

1. **Schema Creation**: Creating new tables (e.g., `CREATE TABLE refreshTokens`).
2. **Schema Modification**: Altering existing tables (e.g., `ALTER TABLE logs ADD COLUMN resourceId VARCHAR(36)`).
3. **Data Migration**: Inserting or updating data (e.g., permissions data).
4. **Relationship Management**: Adding or removing foreign key constraints.

### Reversibility

Each `up` migration should have a corresponding `down` migration to revert changes.

## Database Engine Settings

### Character Set and Collation

1. UTF-8 character encoding: `DEFAULT CHARACTER SET utf8mb4`.
2. Case-insensitive collation with accent sensitivity: `COLLATE utf8mb4_0900_ai_ci`.

#### Important: NO PAD Collation Behavior

The `utf8mb4_0900_ai_ci` collation is a **NO PAD** collation, which has important implications for string handling:

**Key Differences from PAD SPACE Collations:**

1. **Trailing Spaces Are Significant**: Unlike older PAD SPACE collations, trailing spaces are treated as part of the string value.
   - `'value'` and `'value '` are considered **different** strings
   - This affects comparisons, sorting, and grouping operations

2. **Impact on GROUP BY**: Strings with different trailing spaces will be grouped separately

   ```sql
   -- With utf8mb4_0900_ai_ci (NO PAD):
   SELECT username, COUNT(*) FROM users GROUP BY username;
   -- 'john' and 'john ' will create separate groups
   ```

3. **Impact on UNIQUE Constraints**: Both `'value'` and `'value '` can exist as separate unique values

   ```sql
   -- Both of these INSERTs will succeed with NO PAD collation:
   INSERT INTO users (email) VALUES ('test@example.com');
   INSERT INTO users (email) VALUES ('test@example.com ');  -- Note trailing space
   ```

4. **Impact on WHERE Clauses**: Exact matches require exact spacing

   ```sql
   -- These are different conditions with NO PAD:
   WHERE email = 'test@example.com'
   WHERE email = 'test@example.com '
   ```

**Best Practices to Handle NO PAD Collation:**

1. **Always Trim Input**: Use application-layer validation to trim all string inputs before database operations

2. **Use Sequelize Setters**: Implement automatic trimming in model definitions

   ```javascript
   email: {
     type: DataTypes.STRING,
     allowNull: false,
     unique: true,
     set(value) {
       // Trim to prevent issues with NO PAD collation
       this.setDataValue('email', value ? value.trim() : value);
     }
   }
   ```

3. **Test GROUP BY Queries**: After migration from older MySQL versions, thoroughly test all GROUP BY operations

4. **Data Migration**: When upgrading from older MySQL versions with PAD SPACE collations:
   - Scan existing data for trailing spaces
   - Clean data before migration
   - Test all unique constraints after migration

5. **Review Joins**: Verify that JOIN operations on string columns work as expected

### Storage Engine

InnoDB: Used for all tables to support transactions and foreign key constraints.

### Time Zone Setting

UTC is used as the standard time zone: `SET GLOBAL time_zone = '+0:00'`.

## MySQL 9.0 Compatibility

This section covers important compatibility considerations when using MySQL 9.0 or planning to upgrade from earlier versions.

### Authentication Changes

MySQL 9.0 has **removed** the `mysql_native_password` authentication plugin, which was deprecated in MySQL 8.0. This has important implications:

**Key Changes:**

1. **Default Authentication**: `caching_sha2_password` is now the only supported authentication method for new connections
2. **Legacy Clients**: Older MySQL clients that don't support `caching_sha2_password` cannot connect
3. **Driver Requirements**: Ensure your database drivers are updated to support the new authentication method

**Required Updates:**

- **mysql2 driver**: Version 3.6.0 or later
- **sequelize ORM**: Version 6.35.0 or later

**Configuration Example:**

```javascript
// In database.js configuration
dialectOptions: {
  // Explicit authentication plugin configuration
  authPlugins: {
    caching_sha2_password: () => () => Buffer.from([])
  },
  // Explicit charset and collation
  charset: 'utf8mb4',
  collate: 'utf8mb4_0900_ai_ci'
}
```

### New Features Available

**VECTOR Data Type (MySQL 9.0+):**

MySQL 9.0 introduces the VECTOR data type for AI/ML applications:

```sql
CREATE TABLE embeddings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  document_id VARCHAR(36) NOT NULL,
  vector_data VECTOR(768),  -- 768 dimensions, max 16383
  created DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

**INTERSECT and EXCEPT Operators:**

Available since MySQL 8.0.31, these set operators provide cleaner syntax for certain queries:

```sql
-- INTERSECT: Find common values
SELECT user_id FROM premium_users
INTERSECT
SELECT user_id FROM active_users;

-- EXCEPT: Find differences
SELECT user_id FROM all_users
EXCEPT
SELECT user_id FROM banned_users;
```

### Deprecated Features to Avoid

**Mixed Transaction Types:**

MySQL 9.0 deprecates transactions that update both transactional (InnoDB) and non-transactional (MyISAM) tables,
generating warnings. This project exclusively uses InnoDB, so no action is needed.

**Information Schema Tables:**

The following Information Schema tables are deprecated:

- `TP_THREAD_GROUP_STATE`
- `TP_THREAD_GROUP_STATS`
- `TP_THREAD_STATE`

These are not used in this project's standard patterns.

### Version-Specific Recommendations

**MySQL 8.4 LTS (Recommended for Production):**

- Long-term support until April 2032
- Stable and well-tested
- Recommended for production deployments

**MySQL 9.0.1+ (Innovation Release):**

- Latest features including VECTOR type
- **Avoid MySQL 9.0.0** - it was removed from distribution due to critical bugs
- Suitable for development and testing of new features
- Shorter support lifecycle than LTS releases

### Upgrade Checklist

When upgrading to MySQL 9.0:

1. **Update Dependencies:**
   - [ ] mysql2 to version 3.6.0+
   - [ ] sequelize to version 6.35.0+

2. **Review String Data:**
   - [ ] Scan for trailing spaces in string columns
   - [ ] Verify UNIQUE constraints
   - [ ] Test GROUP BY operations

3. **Test Authentication:**
   - [ ] Verify connection with caching_sha2_password
   - [ ] Test connection pooling
   - [ ] Verify SSL connections if used

4. **Verify Compatibility:**
   - [ ] Run full test suite
   - [ ] Test all SQL queries
   - [ ] Monitor for deprecation warnings

## Security Considerations

### Avoiding SQL Injection

SQL injection vulnerabilities are a serious security risk. In Node.js applications:

1. **Use an ORM or Query Builder**: Sequelize, TypeORM, or Knex.js provide built-in protection against SQL injection.
2. **Parameterized Queries**: Always use parameterized queries with the MySQL driver.
3. **Input Validation**: Validate all input before using it in database queries.

Example with Sequelize ORM:

```javascript
// Safely querying with Sequelize
const user = await User.findOne({
  where: { id: userId },
});
```

Example with MySQL2 driver:

```javascript
// Safely querying with parameterized query
const [rows] = await connection.execute("SELECT * FROM users WHERE id = ?", [
  userId,
]);
```

### Avoid Reserved Words

SQL reserved words should not be used as table or column names to prevent issues with different databases.

A list of MySQL reserved words: [MySQL Reserved Words](http://dev.mysql.com/doc/refman/8.0/en/reserved-words.html)

## Role-Based Authorization Design

### Permission Model

1. Granular permissions stored in a dedicated `permissions` table.
2. Junction table `userPermissions` to assign permissions to users.
3. JSON column `permissions` for storing complex permission structures.

### Role System

Role-based access control implemented via `ENUM` fields:

- User roles: `'superadmin'`, `'admin'`, `'attendee'`
- Team member roles: `'teamMember'`, `'teamAdmin'`

## Data Integrity Patterns

### Soft Deletion

When implementing soft deletion:

```sql
ALTER TABLE users ADD COLUMN deletedAt DATETIME NULL DEFAULT NULL;
```

And in queries:

```sql
SELECT * FROM users WHERE deletedAt IS NULL;
```

### Audit Trailing

1. `logs` table captures events with metadata.
2. `created` and `updated` timestamp columns track record changes.

### Foreign Key Constraints

1. `ON DELETE CASCADE` ensures referential integrity by automatically removing child records.
2. `ON UPDATE CASCADE` propagates identifier changes to related tables.

## Node.js Integration

### ORM Usage

We use Sequelize as our primary ORM. Models should follow the same naming conventions as tables but in singular form and PascalCase:

```javascript
// User model for 'users' table
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    // Additional fields...
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created",
    updatedAt: "updated",
  },
);
```

### Transaction Management

Always use transactions for operations that affect multiple tables:

```javascript
const transaction = await sequelize.transaction();

try {
  // Create a team
  const team = await Team.create(
    {
      name: "New Team",
      teamId: uuidv4(),
    },
    { transaction },
  );

  // Add a member to the team
  await TeamMember.create(
    {
      teamId: team.teamId,
      userId: currentUser.userId,
      role: "teamAdmin",
    },
    { transaction },
  );

  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### Connection Pooling

Configure appropriate connection pooling settings:

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

## Schema Evolution Patterns

1. **Additive Changes**: Prefer adding new tables or columns rather than modifying existing ones.
2. **Constraint Management**: Add foreign key constraints after table creation.
3. **Data Type Refinement**: Be cautious when changing column types on existing data.

## Conclusion

Following these SQL standards and design patterns will ensure consistency, maintainability, and security in your
Node.js applications. The database design supports multi-tenant applications with team-based collaboration,
role-based access control, and comprehensive event logging.
