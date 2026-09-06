# Localizarr - AI Agent Documentation

This document provides context and guidelines for AI agents working on the Localizarr project.

## Project Overview

**Localizarr** is an intelligent AI-powered proxy that solves localization issues in Sonarr, Radarr, Lidarr, and Readarr. It automatically identifies and translates foreign language titles using Ollama LLM.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js 18+, TypeScript, AdonisJS 6 |
| **Frontend** | Svelte 4, SvelteKit, Vite |
| **Database** | SQLite (better-sqlite3) with Lucid ORM |
| **AI** | Ollama (LLM) |
| **Testing** | Japa (backend), Vitest (frontend) |
| **Build** | Turbo monorepo |

## Project Structure

```
localizarr/
├── backend/                    # AdonisJS API server
│   ├── app/
│   │   ├── controllers/       # HTTP controllers
│   │   │   ├── proxy_controller.ts
│   │   │   ├── titles_controller.ts
│   │   │   └── logs_controller.ts
│   │   ├── services/          # Business logic
│   │   │   ├── ollama_service.ts      # LLM integration
│   │   │   ├── queue_service.ts       # Queue management
│   │   │   ├── proxy_request_service.ts
│   │   │   ├── url_parser_service.ts
│   │   │   └── title_matching_service.ts
│   │   ├── models/            # Database models (Lucid)
│   │   ├── middleware/        # HTTP middleware
│   │   └── repositories/      # Data access
│   ├── config/                # AdonisJS config files
│   ├── database/
│   │   ├── migrations/        # Schema migrations
│   │   └── seeders/          # Data seeders
│   ├── start/
│   │   ├── routes.ts          # API routes
│   │   └── kernel.ts         # HTTP kernel
│   ├── tests/
│   │   ├── unit/             # Unit tests
│   │   └── functional/       # Integration tests
│   └── queues/               # Filesystem queue storage
├── frontend-svelte/           # SvelteKit frontend
│   ├── src/
│   │   └── routes/           # SvelteKit routes
│   ├── tests/                # Vitest tests
│   └── package.json
├── .github/                   # GitHub config
│   └── copilot-instructions.md
└── package.json               # Monorepo root
```

## Commands

### Root (Monorepo)

```bash
npm run dev          # Start all services
npm run build        # Build all packages
npm run test         # Run frontend tests
npm run lint         # Lint all packages
npm run typecheck    # TypeScript check
```

### Backend

```bash
cd backend
npm run dev          # Start dev server (hot reload)
npm run test         # Run unit tests
npm run test:functional  # Run functional tests
npm run test:all     # Run all tests
npm run migr         # Run migrations
npm run seed         # Run seeders
npm run import:titles    # Import IMDb titles
npm run import:titles:force  # Force re-import
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

### Frontend

```bash
cd frontend-svelte
npm run dev          # Start dev server
npm run build        # Build for production
npm run test         # Run Vitest tests
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5005 | Main app port |
| `PROXY_PORT` | 5006 | Prowlarr proxy port |
| `APP_KEY` | Required | AdonisJS app key |
| `DB_CONNECTION` | sqlite | Database type |
| `ENABLE_OLLAMA` | true | Enable LLM processing |
| `USE_QUEUED_LLM` | false | Async queue processing |
| `OLLAMA_URL` | http://localhost:11434 | Ollama server |
| `OLLAMA_MODEL` | qwen3:1.7b | LLM model |
| `LLM_CACHE_EXPIRY_SECONDS` | 3600 | Cache TTL |

## Code Conventions

### TypeScript

- Use TypeScript for all new code
- Prefer explicit types over `any`
- Use interfaces for object shapes

### Backend (AdonisJS)

- Follow AdonisJS conventions
- Use Lucid ORM for database operations
- Use VineJS for validation
- Controllers go in `app/controllers/`
- Services go in `app/services/`
- Models go in `app/models/`

### Frontend (Svelte)

- Svelte 4 syntax (not Svelte 5 runes)
- Use TypeScript in `.svelte` files with `<script lang="ts">`
- Co-locate tests near components: `component.svelte` and `component.test.ts`

### Testing

- **Backend**: Japa test runner
  - Unit: `tests/unit/`
  - Functional: `tests/functional/`
- **Frontend**: Vitest
  - Tests in `tests/` directory

### Import Aliases

The backend uses these import aliases:
```typescript
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
// Controllers: #controllers/*
// Models: #models/*
// Services: #services/*
// Config: #config/*
```

## Database Models

### Title
- `id`, `imdb_id`, `title`, `type` (movie/tv), `year`, `created_at`, `updated_at`

### LocalizedName
- `id`, `title_id`, `locale`, `name`, `is_original`, `created_at`, `updated_at`

### ExecutionLog
- `id`, `method`, `url`, `target_url`, `status_code`, `response_time_ms`, `host`, `created_at`

### LlmCache
- `id`, `cache_key`, `prompt`, `response`, `created_at`, `expires_at`

### ProxyCache
- `id`, `cache_key`, `content_type`, `body`, `created_at`, `expires_at`

## Key Services

### OllamaService (`app/services/ollama_service.ts`)
- Handles LLM communication with Ollama
- Manages caching of LLM responses
- Uses SHA-256 for cache keys

### QueueService (`app/services/queue_service.ts`)
- Filesystem-based message queue
- Processes titles asynchronously when `USE_QUEUED_LLM=true`

### ProxyService (`app/services/proxy_service.ts`)
- Main proxy logic
- Intercepts requests to indexers
- Modifies responses to translate titles

### UrlParserService (`app/services/url_parser_service.ts`)
- Parses and extracts parameters from proxy requests
- Handles different content types (JSON, XML, RSS, HTML)

## Common Tasks

### Adding a New Route

1. Add route in `backend/start/routes.ts`
2. Create controller in `backend/app/controllers/`
3. Add validation if needed using VineJS
4. Add tests in `backend/tests/functional/`

### Adding a New Model

1. Create migration in `backend/database/migrations/`
2. Create model in `backend/app/models/`
3. Add seeder if needed in `backend/database/seeders/`

### Running Tests

```bash
# Backend tests
cd backend && npm run test              # Unit
cd backend && npm run test:functional    # Functional
cd backend && npm run test:all           # All

# Frontend tests
cd frontend-svelte && npm run test
```

## Important Files

- `backend/adonisrc.ts` - AdonisJS configuration
- `backend/start/routes.ts` - API route definitions
- `backend/start/kernel.ts` - Middleware registration
- `backend/config/database.ts` - Database configuration
- `backend/app/services/ollama_service.ts` - LLM integration
- `frontend-svelte/vite.config.js` - Vite configuration
- `turbo.json` - Turbo monorepo configuration

## Git Branch Strategy

- `main` - Production branch
- `feat/*` - Feature branches
- `fix/*` - Bug fix branches

## Additional Resources

- [README.md](./README.md) - User documentation
- [README-dev.md](./README-dev.md) - Developer documentation
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
