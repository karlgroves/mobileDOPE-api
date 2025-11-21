# TypeScript Standards and Guidelines

> **Navigation:** [Main Documentation](./README.md#documentation-navigation) |
> [Node.js Standards](./node_structure_and_naming_conventions.md) | [Global Rules](./global-rules.md) |
> [Technologies](./technologies.md)

## Table of Contents

* [Purpose](#purpose)
* [TypeScript Configuration](#typescript-configuration)
  * [Compiler Options](#compiler-options)
    * [Target and Module Settings](#target-and-module-settings)
    * [Strict Type Checking](#strict-type-checking)
    * [Path Mapping](#path-mapping)
* [Type Definition Standards](#type-definition-standards)
  * [Interface Naming](#interface-naming)
  * [Type Aliases](#type-aliases)
  * [Generic Type Parameters](#generic-type-parameters)
* [Function and Method Standards](#function-and-method-standards)
  * [Function Signatures](#function-signatures)
  * [Optional vs Required Parameters](#optional-vs-required-parameters)
* [Error Handling Standards](#error-handling-standards)
  * [Custom Error Types](#custom-error-types)
* [Utility Types and Patterns](#utility-types-and-patterns)
  * [Common Utility Types](#common-utility-types)
  * [Configuration and Constants](#configuration-and-constants)
* [Module and Import Standards](#module-and-import-standards)
  * [Import Organization](#import-organization)
  * [Export Patterns](#export-patterns)
* [Testing with TypeScript](#testing-with-typescript)
  * [Test Type Safety](#test-type-safety)
* [Integration with Node.js Standards](#integration-with-nodejs-standards)
  * [Express.js Integration](#expressjs-integration)
* [Performance Considerations](#performance-considerations)
  * [Type-Only Imports](#type-only-imports)
  * [Lazy Loading Types](#lazy-loading-types)
* [Migration Strategy](#migration-strategy)
  * [From JavaScript to TypeScript](#from-javascript-to-typescript)
* [Tools Integration](#tools-integration)
  * [ESLint Configuration](#eslint-configuration)
  * [Jest Configuration](#jest-configuration)
* [Best Practices Summary](#best-practices-summary)
* [Resources](#resources)

## Purpose

This document outlines TypeScript coding standards, configuration guidelines, and best practices for REST-SPEC
projects. These standards ensure type safety, maintainability, and consistency across TypeScript codebases.

## TypeScript Configuration

### Compiler Options

#### Target and Module Settings

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "moduleResolution": "node"
  }
}
```

#### Strict Type Checking

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true
  }
}
```

#### Path Mapping

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@shared/*": ["shared/*"],
      "@scripts/*": ["scripts/*"],
      "@tests/*": ["tests/*"],
      "@types/*": ["types/*"]
    }
  }
}
```

## Type Definition Standards

### Interface Naming

* Use PascalCase for interface names
* Prefix interfaces with `I` only when necessary to avoid naming conflicts
* Use descriptive, domain-specific names

```typescript
// ✅ Good
interface UserProfile {
  id: string;
  email: string;
  name: string;
}

interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
}

// ❌ Avoid
interface IUser {  // Unnecessary I prefix
  data: any;       // Too generic
}
```

### Type Aliases

* Use PascalCase for type aliases
* Prefer union types over enums when possible
* Use descriptive names that indicate the domain

```typescript
// ✅ Good
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type DatabaseProvider = 'mysql' | 'mariadb';
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ✅ Complex types
type ApiResponse<T> = {
  data: T;
  status: 'success' | 'error';
  message?: string;
};

// ❌ Avoid
type Methods = string;  // Too generic
type DB = any;          // No type safety
```

### Generic Type Parameters

* Use single uppercase letters starting with `T`
* Use descriptive names for complex generics
* Provide default types when appropriate

```typescript
// ✅ Good
interface Repository<T, K = string> {
  findById(id: K): Promise<T | null>;
  save(entity: T): Promise<T>;
}

interface ApiEndpoint<TRequest, TResponse> {
  method: HttpMethod;
  path: string;
  handler: (req: TRequest) => Promise<TResponse>;
}

// ❌ Avoid
interface Repository<Type, KeyType> {  // Too verbose for simple cases
  findById(id: KeyType): Promise<Type | null>;
}
```

## Function and Method Standards

### Function Signatures

* Always specify return types explicitly
* Use readonly for parameters that shouldn't be modified
* Prefer specific types over `any` or `unknown`

```typescript
// ✅ Good
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function fetchUser(id: string): Promise<UserProfile | null> {
  try {
    const response = await userRepository.findById(id);
    return response;
  } catch (error) {
    logger.error('Failed to fetch user', { id, error });
    return null;
  }
}

function processItems(items: readonly Item[]): ProcessedItem[] {
  return items.map(item => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString()
  }));
}

// ❌ Avoid
function doSomething(data: any): any {  // No type safety
  return data.whatever;
}

async function getStuff(id) {  // Missing types
  return await something(id);
}
```

### Optional vs Required Parameters

* Use optional parameters judiciously
* Prefer required parameters with default values
* Use object parameters for functions with many arguments

```typescript
// ✅ Good
interface CreateUserOptions {
  name: string;
  email: string;
  role?: UserRole;
  isActive?: boolean;
}

function createUser(options: CreateUserOptions): Promise<User> {
  const user = {
    ...options,
    role: options.role ?? 'user',
    isActive: options.isActive ?? true,
    id: generateId(),
    createdAt: new Date()
  };
  return userRepository.save(user);
}

// ✅ Acceptable for simple cases
function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

// ❌ Avoid
function createUser(
  name: string,
  email: string,
  role?: string,
  isActive?: boolean,
  department?: string,
  manager?: string
): Promise<User> {  // Too many parameters
  // ...
}
```

## Error Handling Standards

### Custom Error Types

* Extend built-in Error class
* Provide structured error information
* Use discriminated unions for error types

```typescript
// ✅ Good
abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(
    message: string,
    public readonly field: string,
    context?: Record<string, any>
  ) {
    super(message, context);
  }
}

class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

// ✅ Result pattern for error handling
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

async function safeParseJson<T>(json: string): Promise<Result<T, SyntaxError>> {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as SyntaxError };
  }
}
```

## Utility Types and Patterns

### Common Utility Types

```typescript
// ✅ Useful utility types
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

type OptionalKeys<T, K extends keyof T> = T & Partial<Pick<T, K>>;

type NonEmptyArray<T> = [T, ...T[]];

// ✅ Branded types for domain-specific values
type EmailAddress = string & { __brand: 'EmailAddress' };
type UserId = string & { __brand: 'UserId' };
type Timestamp = number & { __brand: 'Timestamp' };

function validateEmail(email: string): EmailAddress | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email as EmailAddress : null;
}
```

### Configuration and Constants

```typescript
// ✅ Good - typed configuration
interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly ssl: boolean;
  readonly connectionTimeout: number;
}

interface ApiConfig {
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly jwtSecret: string;
  readonly logLevel: LogLevel;
}

// ✅ Const assertions for immutable data
const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;

type HttpStatusCode = typeof HTTP_STATUS_CODES[keyof typeof HTTP_STATUS_CODES];

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;
type Currency = typeof SUPPORTED_CURRENCIES[number];
```

## Module and Import Standards

### Import Organization

```typescript
// ✅ Good import organization
// 1. Node.js built-in modules
import { promises as fs } from 'fs';
import path from 'path';

// 2. External dependencies
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (absolute paths)
import { UserRepository } from '@shared/repositories';
import { Logger } from '@shared/utils';

// 4. Relative imports
import { validateUserInput } from './validation';
import { UserService } from '../services';

// ✅ Type-only imports
import type { Request, Response } from 'express';
import type { UserProfile, CreateUserRequest } from '@shared/types';
```

### Export Patterns

```typescript
// ✅ Named exports (preferred)
export interface UserService {
  createUser(data: CreateUserRequest): Promise<User>;
  findUserById(id: UserId): Promise<User | null>;
}

export class DefaultUserService implements UserService {
  // implementation
}

export const userService = new DefaultUserService();

// ✅ Re-exports for clean APIs
export type {
  UserProfile,
  CreateUserRequest,
  UpdateUserRequest
} from './types';

export {
  UserService,
  DefaultUserService,
  userService
} from './user-service';

// ✅ Default exports only for single-purpose modules
export default class ApiServer {
  // implementation
}
```

## Testing with TypeScript

### Test Type Safety

```typescript
// ✅ Good test typing
import type { User, CreateUserRequest } from '../types';
import { UserService } from '../user-service';

describe('UserService', () => {
  let userService: UserService;
  
  beforeEach(() => {
    userService = new UserService();
  });
  
  it('should create a user with valid data', async () => {
    const userData: CreateUserRequest = {
      name: 'John Doe',
      email: 'john@example.com' as EmailAddress,
      role: 'user'
    };
    
    const result = await userService.createUser(userData);
    
    expect(result).toMatchObject<Partial<User>>({
      name: userData.name,
      email: userData.email,
      role: userData.role
    });
  });
});

// ✅ Type-safe mocks
const mockUserRepository: jest.Mocked<UserRepository> = {
  findById: jest.fn(),
  save: jest.fn(),
  delete: jest.fn()
};
```

## Integration with Node.js Standards

### Express.js Integration

```typescript
// ✅ Typed Express handlers
interface AuthenticatedRequest extends Request {
  user: UserProfile;
}

type AsyncHandler<T extends Request = Request> = (
  req: T,
  res: Response,
  next: NextFunction
) => Promise<void>;

const createUser: AsyncHandler<Request> = async (req, res, next) => {
  try {
    const userData = CreateUserSchema.parse(req.body);
    const user = await userService.createUser(userData);
    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
};

const getUser: AsyncHandler<AuthenticatedRequest> = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.findById(id as UserId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};
```

## Performance Considerations

### Type-Only Imports

```typescript
// ✅ Use type-only imports to reduce bundle size
import type { User } from './types';
import type { Request, Response } from 'express';

// ✅ Import only what you need
import { pick, omit } from 'lodash';

// ❌ Avoid importing entire libraries
import * as lodash from 'lodash';
```

### Lazy Loading Types

```typescript
// ✅ Conditional type loading
type DatabaseConnection = import('./database').Connection;

async function getDatabaseConnection(): Promise<DatabaseConnection> {
  const { createConnection } = await import('./database');
  return createConnection();
}
```

## Migration Strategy

### From JavaScript to TypeScript

1. **Gradual Migration**
   * Start with `.ts` extension on new files
   * Add `// @ts-check` to JavaScript files
   * Convert one module at a time

2. **Type Declaration Files**
   * Create `.d.ts` files for existing JavaScript modules
   * Gradually replace with TypeScript implementations

3. **Configuration Updates**
   * Update build scripts to handle TypeScript
   * Configure Jest for TypeScript testing
   * Update linting rules for TypeScript

## Tools Integration

### ESLint Configuration

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/prefer-readonly": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Jest Configuration

```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!src/**/*.d.ts"
  ]
}
```

## Best Practices Summary

1. **Always use explicit types** - Avoid `any` and `unknown` unless absolutely necessary
2. **Prefer interfaces over type aliases** for object shapes that might be extended
3. **Use strict TypeScript configuration** - Enable all strict mode options
4. **Write type-safe tests** - Ensure your tests are as type-safe as your application code
5. **Use utility types** - Leverage TypeScript's built-in and custom utility types
6. **Keep types close to usage** - Define types near where they're used when possible
7. **Document complex types** - Use JSDoc comments for complex type definitions
8. **Regular type checking** - Run `tsc --noEmit` in CI/CD pipelines

## Resources

* [TypeScript Handbook](https://www.typescriptlang.org/docs/)
* [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
* [Effective TypeScript](https://effectivetypescript.com/)
* [TypeScript ESLint Rules](https://typescript-eslint.io/rules/)
