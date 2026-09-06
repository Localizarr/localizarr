# LLM Coding Guide - Localizarr

This guide helps AI agents write code that follows Localizarr's conventions and patterns.

## General Principles

1. **TypeScript First**: All code must be TypeScript
2. **Explicit Types**: Avoid `any`, use proper interfaces
3. **Follow Framework Conventions**: AdonisJS patterns for backend, Svelte patterns for frontend
4. **Test Coverage**: Add tests for new functionality
5. **No Secrets**: Never commit API keys, passwords, or secrets

## Backend (AdonisJS)

### Project Structure

```
backend/
├── app/
│   ├── controllers/    # HTTP request handlers
│   ├── services/       # Business logic
│   ├── models/         # Database models
│   ├── middleware/     # HTTP middleware
│   └── repositories/   # Data access layer
├── config/             # Configuration files
├── database/
│   ├── migrations/     # Schema migrations
│   └── seeders/        # Data seeders
├── start/
│   ├── routes.ts       # Route definitions
│   └── kernel.ts       # Middleware registration
└── tests/
    ├── unit/           # Unit tests
    └── functional/     # Integration tests
```

### Creating a New Controller

```typescript
// backend/app/controllers/example_controller.ts
import type { HttpContext } from '@adonisjs/core/http'

export default class ExampleController {
  public async index({ request, response }: HttpContext) {
    const param = request.input('param')
    // Business logic here
    return response.ok({ data: param })
  }

  public async store({ request, response }: HttpContext) {
    const body = request.body()
    // Validation with VineJS can be added here
    return response.created({ message: 'Created' })
  }
}
```

### Creating a New Service

```typescript
// backend/app/services/example_service.ts
import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'

@inject()
export class ExampleService {
  constructor(private logger: Logger) {}

  public async processSomething(input: string): Promise<string> {
    this.logger.info(`Processing: ${input}`)
    // Business logic
    return `Processed: ${input}`
  }
}
```

### Creating a New Model

```typescript
// backend/app/models/example.ts
import { DateTime } from 'luxon'
import { BaseModel } from '@adonisjs/lucid/orm'

export default class Example extends BaseModel {
  static table = 'examples'

  public id!: number
  public name!: string
  public createdAt!: DateTime
  public updatedAt!: DateTime
}
```

### Creating a Migration

```typescript
// backend/database/migrations/xxxx_create_examples_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'examples'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### Creating a Route

```typescript
// backend/start/routes.ts
import router from '@adonisjs/core/services/router'
const ExampleController = () => import('#controllers/example_controller')

router.get('/examples', [ExampleController, 'index'])
router.post('/examples', [ExampleController, 'store'])
```

### Dependency Injection

Use `@inject()` decorator for services:

```typescript
import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'

@inject()
export class MyService {
  constructor(private logger: Logger) {}
}
```

### Import Aliases

Use these shortcuts:

```typescript
// Instead of relative paths:
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import Example from '#models/example'
import ExampleService from '#services/example_service'
```

### Validation with VineJS

```typescript
import { vine } from '#validators/validator'

const createExampleSchema = vine.object({
  name: vine.string().minLength(3),
  email: vine.string().email(),
})

// In controller:
public async store({ request, response }: HttpContext) {
  const data = await request.validateUsing(createExampleSchema)
  // ...
}
```

## Frontend (Svelte)

### Project Structure

```
frontend-svelte/
├── src/
│   └── routes/           # SvelteKit routes
│       ├── +page.svelte  # Main page
│       └── +page.ts     # Page load function
├── tests/               # Vitest tests
└── package.json
```

### Creating a Page

```svelte
<!-- frontend-svelte/src/routes/example/+page.svelte -->
<script lang="ts">
  export let data
</script>

<h1>{data.title}</h1>
```

```typescript
// frontend-svelte/src/routes/example/+page.ts
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/examples')
  const data = await response.json()
  
  return {
    title: data.title
  }
}
```

### Adding Tests

```typescript
// frontend-svelte/tests/example.test.ts
import { describe, it, expect } from 'vitest'

describe('example test', () => {
  it('should pass', () => {
    expect(true).toBe(true)
  })
})
```

## Database Operations

### Query Builder

```typescript
// Using Lucid ORM
const title = await Title.query()
  .where('imdb_id', imdbId)
  .first()

// Using raw query
const result = await Database.rawQuery(
  'SELECT * FROM titles WHERE year = ?',
  [2024]
)
```

### Creating Records

```typescript
const title = await Title.create({
  imdb_id: 'tt1234567',
  title: 'Example Movie',
  type: 'movie',
  year: 2024,
})
```

## Testing

### Unit Test Example

```typescript
// backend/tests/unit/example_service.spec.ts
import { test } from '@japa/runner'
import { ExampleService } from '#services/example_service'

test('should process input', async ({ assert }) => {
  const service = new ExampleService()
  const result = await service.processSomething('test')
  
  assert.equal(result, 'Processed: test')
})
```

### Functional Test Example

```typescript
// backend/tests/functional/example.spec.ts
import { test } from '@japa/router'
import { testClient } from '@japa/runner'

test('GET /examples returns list', async ({ client }) => {
  const response = await client.get('/examples')
  
  response.assertStatus(200)
  response.assertBodyContains({ data: [] })
})
```

## Common Patterns

### Error Handling

```typescript
try {
  const result = await service.process()
  return response.ok(result)
} catch (error) {
  logger.error(error)
  return response.internalServerError({ message: 'Error processing request' })
}
```

### Logging

```typescript
import { Logger } from '@adonisjs/core/logger'

@inject()
export class Service {
  constructor(private logger: Logger) {}
  
  public doSomething() {
    this.logger.info('Starting process')
    this.logger.debug('Debug info:', { key: 'value' })
    this.logger.error('Error occurred:', error)
  }
}
```

### Configuration Access

```typescript
import { Config } from '@adonisjs/core/config'

@inject()
export class Service {
  constructor(private config: Config) {}
  
  public getSetting() {
    return this.config.get('app.port', 3000)
  }
}
```

## Code Style Rules

1. **No comments** unless absolutely necessary
2. **Use const** over let when possible
3. **Use async/await** instead of raw promises
4. **Use template literals** for string interpolation
5. **Use strict equality** (===) over loose equality (==)
6. **Use destructuring** for objects and arrays
7. **Use early returns** to reduce nesting

## File Naming

- Controllers: `snake_case_controller.ts`
- Services: `snake_case_service.ts`
- Models: `snake_case.ts`
- Migrations: `xxxx_create_table_name_table.ts`
- Tests: `*.spec.ts` for unit, `*.spec.ts` for functional

## Running Commands

```bash
# Development
npm run dev

# Testing
npm run test           # Unit tests
npm run test:functional  # Functional tests
npm run test:all       # All tests

# Linting
npm run lint
npm run typecheck

# Database
npm run migr           # Run migrations
npm run seed           # Run seeders
npm run reset:db       # Reset database
```

## Important Files Reference

| File | Purpose |
|------|---------|
| `backend/start/routes.ts` | API route definitions |
| `backend/start/kernel.ts` | Middleware setup |
| `backend/config/database.ts` | Database configuration |
| `backend/config/app.ts` | App settings |
| `frontend-svelte/vite.config.js` | Vite configuration |
| `turbo.json` | Monorepo configuration |
