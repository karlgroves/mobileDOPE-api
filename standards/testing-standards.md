# Testing Standards and Guidelines

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) |
> [Node.js Standards](./node_structure_and_naming_conventions.md) | [Global Rules](./global-rules.md) |
> [Technologies](./technologies.md)

## Table of Contents

- [Purpose](#purpose)
- [Testing Philosophy](#testing-philosophy)
  - [Core Principles](#core-principles)
  - [Testing Pyramid](#testing-pyramid)
- [Test Framework Configuration](#test-framework-configuration)
  - [Jest Configuration](#jest-configuration)
  - [Test Setup File](#test-setup-file)
- [Unit Testing Standards](#unit-testing-standards)
  - [Test Structure and Naming](#test-structure-and-naming)
  - [Testing Async Operations](#testing-async-operations)
  - [Mocking Best Practices](#mocking-best-practices)
- [Integration Testing Standards](#integration-testing-standards)
  - [Database Integration Tests](#database-integration-tests)
  - [API Testing with Authentication](#api-testing-with-authentication)
- [End-to-End Testing Standards](#end-to-end-testing-standards)
  - [E2E Test Setup](#e2e-test-setup)
- [Testing Database Operations](#testing-database-operations)
  - [Repository Testing](#repository-testing)
  - [Transaction Testing](#transaction-testing)
- [Testing Middleware](#testing-middleware)
  - [Authentication Middleware Testing](#authentication-middleware-testing)
  - [Error Handling Middleware Testing](#error-handling-middleware-testing)
- [Performance Testing](#performance-testing)
  - [Load Testing with Jest](#load-testing-with-jest)
- [Test Data Management](#test-data-management)
  - [Fixtures and Factories](#fixtures-and-factories)
  - [Database Seeding for Tests](#database-seeding-for-tests)
- [Continuous Integration Testing](#continuous-integration-testing)
  - [GitHub Actions Configuration](#github-actions-configuration)
- [Test Scripts Configuration](#test-scripts-configuration)
  - [Package.json Test Scripts](#packagejson-test-scripts)
- [Testing Best Practices Summary](#testing-best-practices-summary)
  - [DO](#do)
  - [DON'T](#dont)
- [Resources](#resources)

## Purpose

This document outlines comprehensive testing standards, patterns, and best practices for REST-SPEC projects. These
standards ensure reliable, maintainable, and comprehensive test coverage across all aspects of Node.js RESTful API
applications.

## Testing Philosophy

### Core Principles

- **Test-Driven Development (TDD)**: Always apply Test-Driven Development - write tests before or alongside code to define expected behavior
- **Behavior-Driven Development (BDD)**: Favor BDD where appropriate - tests should describe observable behavior rather than internal implementation details
- **No Placeholder Tests**: Do not generate placeholder, empty, or fake tests (e.g., tests that contain `expect(true).toBe(true)` or meaningless assertions) simply to increase code coverage
- **Real Browser Testing**: Front-end tests must run in a real browser environment (e.g. via Puppeteer, Playwright) instead of jsdom or simulated DOM unless explicitly justified
- **Comprehensive Coverage**: Aim for 90%+ code coverage with meaningful tests
- **Fast Feedback**: Unit tests should run in milliseconds, integration tests in seconds
- **Isolated Testing**: Each test should be independent and repeatable
- **Clear Intent**: Tests should serve as living documentation of expected behavior

### Testing Pyramid

```plaintext
    E2E Tests (5-10%)
      ↑ Slow, Expensive, Brittle
  Integration Tests (20-30%)
      ↑ Medium Speed, Medium Cost
    Unit Tests (60-70%)
      ↑ Fast, Cheap, Reliable
```

## Test Framework Configuration

### Jest Configuration

```json
{
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],
  "testPathIgnorePatterns": ["/node_modules/", "/build/", "/dist/"],
  "collectCoverageFrom": [
    "src/**/*.js",
    "!src/**/*.test.js",
    "!src/**/*.spec.js",
    "!src/index.js",
    "!src/config/**"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  },
  "setupFilesAfterEnv": ["<rootDir>/tests/setup.js"],
  "testTimeout": 10000
}
```

### Test Setup File

```javascript
// tests/setup.js
const { sequelize } = require("../src/models");

// Global test setup
beforeAll(async () => {
  // Initialize test database
  await sequelize.authenticate();
});

afterAll(async () => {
  // Clean up test database
  await sequelize.close();
});

// Mock external services
jest.mock("../src/services/emailService", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Global test helpers
global.testHelpers = {
  createMockUser: () => ({
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
  }),
};
```

## Unit Testing Standards

### Test Structure and Naming

- **Descriptive Names**: Have descriptive, human-readable names that clearly state the intent (e.g., "renders login form with empty fields by default" rather than "test1")
- **AAA Pattern**: Follow the AAA pattern: Arrange, Act, Assert
- **Test Organization**: Group related tests using `describe` blocks
- **Test Cases**: Use `it` or `test` for individual test cases
- **Coverage Requirements**: All tests must cover:
  - Happy paths
  - Common edge cases
  - Error and failure conditions
- **Avoid Brittle Selectors**: Avoid brittle selectors or overly tight coupling to non-essential implementation details (e.g., prefer testing via user-visible elements over internal class names)

### Test Quality Standards

- **Meaningful Assertions**: Never generate tests that pass without meaningful assertions or fabricate behavior the code does not provide
- **Runnable Tests**: Tests must be runnable as-is with the specified tooling (no fictional libraries or APIs)
- **Integration Over Unit**: Prefer integration-level tests for user interfaces that simulate real user interaction rather than isolated unit tests where feasible
- **API Testing Requirements**:
  - Validate request/response structure, including headers, status codes, and body content
  - Include tests for invalid inputs, authorization failures, and rate limiting or similar controls
- **Test Documentation**: Include code examples of running tests (e.g., npm test, pytest) if generating documentation alongside tests
- **Mocking Guidelines**:
  - Use realistic data structures — never make up object shapes or API fields that don't exist
  - Note assumptions or boundaries clearly in comments
  - If uncertain about exact behavior of external APIs or systems, generate TODO comments or request clarifications rather than inventing responses or mocks

```javascript
// ✅ Good test structure
describe("UserService", () => {
  let userService;
  let mockUserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    userService = new UserService(mockUserRepository);
  });

  describe("createUser", () => {
    it("should create a new user with valid data", async () => {
      // Arrange
      const userData = {
        email: "test@example.com",
        name: "Test User",
        password: "securePassword123",
      };
      const expectedUser = { id: "123", ...userData };
      mockUserRepository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(expectedUser);
    });

    it("should throw ValidationError when email is invalid", async () => {
      // Arrange
      const userData = {
        email: "invalid-email",
        name: "Test User",
        password: "securePassword123",
      };

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow(
        ValidationError,
      );
    });
  });
});
```

### Testing Async Operations

```javascript
// ✅ Good async testing patterns
describe("async operations", () => {
  it("should handle async success", async () => {
    const result = await userService.fetchUser("123");
    expect(result).toBeDefined();
  });

  it("should handle async errors", async () => {
    mockUserRepository.findById.mockRejectedValue(new Error("Database error"));

    await expect(userService.fetchUser("123")).rejects.toThrow(
      "Database error",
    );
  });

  it("should handle timeout scenarios", async () => {
    mockUserRepository.findById.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 11000)),
    );

    await expect(userService.fetchUser("123")).rejects.toThrow(
      "Operation timed out",
    );
  }, 12000); // Custom timeout for this test
});
```

### Mocking Best Practices

```javascript
// ✅ Good mocking patterns
describe("UserController", () => {
  let userController;
  let mockUserService;
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    mockUserService = {
      createUser: jest.fn(),
      findUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: "test-user-id" },
    };

    mockResponse = {
      status: jest.fn(() => mockResponse),
      json: jest.fn(() => mockResponse),
      send: jest.fn(() => mockResponse),
    };

    userController = new UserController(mockUserService);
  });

  it("should create user and return 201 status", async () => {
    // Arrange
    const userData = { email: "test@example.com", name: "Test User" };
    const createdUser = { id: "123", ...userData };
    mockRequest.body = userData;
    mockUserService.createUser.mockResolvedValue(createdUser);

    // Act
    await userController.createUser(mockRequest, mockResponse);

    // Assert
    expect(mockUserService.createUser).toHaveBeenCalledWith(userData);
    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({ data: createdUser });
  });
});
```

## Integration Testing Standards

### Database Integration Tests

```javascript
// tests/integration/user.integration.test.js
const request = require("supertest");
const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

describe("User API Integration", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const userData = {
        email: "test@example.com",
        name: "Test User",
        password: "securePassword123",
      };

      const response = await request(app)
        .post("/api/users")
        .send(userData)
        .expect(201);

      expect(response.body.data).toMatchObject({
        email: userData.email,
        name: userData.name,
      });
      expect(response.body.data).not.toHaveProperty("password");

      // Verify database state
      const userInDb = await User.findByPk(response.body.data.id);
      expect(userInDb).toBeTruthy();
      expect(userInDb.email).toBe(userData.email);
    });

    it("should return validation error for invalid email", async () => {
      const userData = {
        email: "invalid-email",
        name: "Test User",
        password: "securePassword123",
      };

      const response = await request(app)
        .post("/api/users")
        .send(userData)
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: "bad_request",
        message: expect.stringContaining("email"),
      });
    });
  });
});
```

### API Testing with Authentication

```javascript
// tests/integration/auth.integration.test.js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../../src/app");

describe("Authenticated API endpoints", () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      email: "test@example.com",
      name: "Test User",
      password: "hashedPassword",
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
  });

  it("should access protected route with valid token", async () => {
    const response = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.data.id).toBe(testUser.id);
  });

  it("should reject access without token", async () => {
    await request(app).get("/api/users/profile").expect(401);
  });

  it("should reject access with invalid token", async () => {
    await request(app)
      .get("/api/users/profile")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);
  });
});
```

## End-to-End Testing Standards

### E2E Test Setup

```javascript
// tests/e2e/user-workflow.e2e.test.js
const request = require("supertest");
const app = require("../../src/app");
const { sequelize } = require("../../src/models");

describe("User Workflow E2E", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it("should complete full user registration and login workflow", async () => {
    const userData = {
      email: "e2e@example.com",
      name: "E2E Test User",
      password: "securePassword123",
    };

    // Step 1: Register user
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send(userData)
      .expect(201);

    expect(registerResponse.body.data).toMatchObject({
      email: userData.email,
      name: userData.name,
    });

    // Step 2: Login user
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    expect(loginResponse.body.data).toHaveProperty("token");
    const token = loginResponse.body.data.token;

    // Step 3: Access protected profile
    const profileResponse = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(profileResponse.body.data.email).toBe(userData.email);

    // Step 4: Update profile
    const updateData = { name: "Updated Name" };
    const updateResponse = await request(app)
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(updateData)
      .expect(200);

    expect(updateResponse.body.data.name).toBe(updateData.name);
  });
});
```

## Testing Database Operations

### Repository Testing

```javascript
// tests/unit/repositories/userRepository.test.js
const { User } = require("../../src/models");
const UserRepository = require("../../src/repositories/userRepository");

// Mock Sequelize model
jest.mock("../../src/models");

describe("UserRepository", () => {
  let userRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const mockUser = { id: "123", email: "test@example.com" };
      User.findByPk.mockResolvedValue(mockUser);

      const result = await userRepository.findById("123");

      expect(User.findByPk).toHaveBeenCalledWith("123");
      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      User.findByPk.mockResolvedValue(null);

      const result = await userRepository.findById("999");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      User.findByPk.mockRejectedValue(new Error("Database connection failed"));

      await expect(userRepository.findById("123")).rejects.toThrow(
        "Database connection failed",
      );
    });
  });
});
```

### Transaction Testing

```javascript
// Testing database transactions
describe("UserService with transactions", () => {
  it("should rollback transaction on error", async () => {
    const mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn(),
    };

    sequelize.transaction.mockResolvedValue(mockTransaction);
    mockUserRepository.create.mockRejectedValue(new Error("Validation failed"));

    await expect(userService.createUserWithProfile(userData)).rejects.toThrow(
      "Validation failed",
    );

    expect(mockTransaction.rollback).toHaveBeenCalled();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });
});
```

## Testing Middleware

### Authentication Middleware Testing

```javascript
// tests/unit/middleware/auth.test.js
const authMiddleware = require("../../src/middleware/auth");
const jwt = require("jsonwebtoken");

jest.mock("jsonwebtoken");

describe("Auth Middleware", () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn(() => mockResponse),
      json: jest.fn(() => mockResponse),
    };
    nextFunction = jest.fn();
  });

  it("should authenticate valid token", async () => {
    const mockUser = { id: "123", email: "test@example.com" };
    mockRequest.headers.authorization = "Bearer valid-token";
    jwt.verify.mockReturnValue(mockUser);

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockRequest.user).toEqual(mockUser);
    expect(nextFunction).toHaveBeenCalled();
  });

  it("should reject missing token", async () => {
    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
```

### Error Handling Middleware Testing

```javascript
// tests/unit/middleware/errorHandler.test.js
const errorHandler = require("../../src/middleware/errorHandler");
const { ValidationError, NotFoundError } = require("../../src/utils/errors");

describe("Error Handler Middleware", () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn(() => mockResponse),
      json: jest.fn(() => mockResponse),
    };
    nextFunction = jest.fn();
  });

  it("should handle ValidationError correctly", () => {
    const error = new ValidationError("Invalid email", "email");

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: "bad_request",
        message: "Invalid email",
        params: [{ param: "email", message: "Invalid email" }],
      },
    });
  });

  it("should handle unexpected errors", () => {
    const error = new Error("Unexpected error");

    errorHandler(error, mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: "internal_server_error",
        message: "Internal server error",
      },
    });
  });
});
```

## Performance Testing

### Load Testing with Jest

```javascript
// tests/performance/api.performance.test.js
describe("API Performance Tests", () => {
  it("should handle concurrent user creation", async () => {
    const concurrentRequests = 50;
    const userData = {
      email: "perf@example.com",
      name: "Performance Test",
      password: "password123",
    };

    const startTime = Date.now();

    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      request(app)
        .post("/api/users")
        .send({ ...userData, email: `perf${i}@example.com` })
        .expect(201),
    );

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Expect all requests to complete within 5 seconds
    expect(duration).toBeLessThan(5000);
  });

  it("should respond to health check quickly", async () => {
    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await request(app).get("/api/health").expect(200);
    }

    const endTime = Date.now();
    const averageTime = (endTime - startTime) / iterations;

    // Expect average response time under 10ms
    expect(averageTime).toBeLessThan(10);
  });
});
```

## Test Data Management

### Fixtures and Factories

```javascript
// tests/fixtures/userFixtures.js
const bcrypt = require("bcrypt");

const userFixtures = {
  validUser: {
    email: "valid@example.com",
    name: "Valid User",
    password: "securePassword123",
  },

  adminUser: {
    email: "admin@example.com",
    name: "Admin User",
    password: "adminPassword123",
    role: "admin",
  },

  createUser: async (overrides = {}) => {
    const userData = {
      ...userFixtures.validUser,
      ...overrides,
    };

    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    return User.create(userData);
  },

  createMultipleUsers: async (count = 5) => {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(
        await userFixtures.createUser({
          email: `user${i}@example.com`,
          name: `User ${i}`,
        }),
      );
    }
    return users;
  },
};

module.exports = userFixtures;
```

### Database Seeding for Tests

```javascript
// tests/helpers/seedDatabase.js
const { User, Team, Project } = require("../../src/models");

const seedDatabase = async () => {
  // Create test users
  const users = await User.bulkCreate([
    { email: "user1@example.com", name: "User One" },
    { email: "user2@example.com", name: "User Two" },
    { email: "admin@example.com", name: "Admin User", role: "admin" },
  ]);

  // Create test teams
  const teams = await Team.bulkCreate([
    { name: "Development Team", ownerId: users[0].id },
    { name: "QA Team", ownerId: users[1].id },
  ]);

  // Create test projects
  await Project.bulkCreate([
    { name: "Project Alpha", teamId: teams[0].id },
    { name: "Project Beta", teamId: teams[1].id },
  ]);

  return { users, teams };
};

const cleanDatabase = async () => {
  await Project.destroy({ where: {}, force: true });
  await Team.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
};

module.exports = { seedDatabase, cleanDatabase };
```

## Continuous Integration Testing

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:9.0.1
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: test_db
        ports:
          * 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      * uses: actions/checkout@v3

      * name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22.x'
          cache: 'npm'

      * name: Install dependencies
        run: npm ci

      * name: Run linting
        run: npm run lint

      * name: Run unit tests
        run: npm run test:unit

      * name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PORT: 3306
          DB_NAME: test_db
          DB_USER: root
          DB_PASS: password

      * name: Run E2E tests
        run: npm run test:e2e

      * name: Generate coverage report
        run: npm run coverage

      * name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

## Test Scripts Configuration

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

## Testing Best Practices Summary

### DO

1. **Write tests first** - Use TDD when possible
2. **Test behavior, not implementation** - Focus on what the code does, not how
3. **Use descriptive test names** - Tests should read like specifications
4. **Keep tests independent** - Each test should be able to run in isolation
5. **Mock external dependencies** - Database, APIs, file system, etc.
6. **Test edge cases** - Empty arrays, null values, boundary conditions
7. **Maintain test data** - Use factories and fixtures for consistent test data
8. **Run tests frequently** - Integrate with CI/CD for every commit

### DON'T

1. **Don't test framework code** - Focus on your business logic
2. **Don't write brittle tests** - Avoid testing implementation details
3. **Don't ignore failing tests** - Fix them immediately or remove them
4. **Don't skip error scenarios** - Test both success and failure paths
5. **Don't use production data** - Always use isolated test databases
6. **Don't write overly complex tests** - Keep tests simple and focused
7. **Don't test multiple things in one test** - One assertion per test when possible
8. **Don't forget to clean up** - Always reset state between tests

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Node.js Applications](https://nodejs.org/en/docs/guides/testing/)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
