# Copilot Instructions for Localizarr

## Project Overview
- **Localizarr** is an AI-powered proxy for *Arr applications (Sonarr, Radarr, Lidarr, Readarr) that localizes media titles using Ollama LLM.
- Built with Node.js, TypeScript, AdonisJS (backend), Vue.js (frontend via Inertia), and SQLite (Lucid ORM).
- Core features: AI-driven title translation, transparent proxying, multi-language support, smart caching, and queue-based async processing.

## Architecture & Key Patterns
- **app/controllers/**: HTTP entrypoints (proxy, titles, logs). Controllers are thin; business logic is in services.
- **app/services/**: Core logic (AI/LLM, proxying, queue, caching). Example: `ollama_service.ts` handles LLM requests and caching.
- **app/models/**: Lucid ORM models for `title`, `localized_name`, `execution_log`, `llm_cache`.
- **app/repositories/**: Data access and title processing logic.
- **app/middleware/**: Auth, container bindings, etc.
- **config/**: AdonisJS and app-specific config (see `database.ts`, `app.ts`).
- **database/migrations/**: Schema for SQLite tables.
- **inertia/**: Vue.js frontend (SSR via Inertia).
- **queues/** and **tmp/queues/**: Filesystem-based message queues for async LLM processing.
- **tests/**: Unit, functional, and LLM integration tests. Use Japa test runner.

## Developer Workflows
- **Install**: `npm install`
- **Dev server**: `npm run dev` (hot reload)
- **Build**: `npm run build`
- **Start**: `npm run start`
- **Migrate DB**: `npm run migr` (see also `migr:rollback`, `seed`, `reset:db`)
- **Import IMDb titles**: `npm run import:titles` or `npm run import:titles:force`
- **Test**: `npm test`, `npm run test:coverage`, `npm run test:llm-integration`
- **Lint/Format**: `npm run lint`, `npm run format`

## Project Conventions
- **TypeScript everywhere**; use static typing.
- **Controllers delegate** to services; keep controllers minimal.
- **Services** encapsulate business logic and cross-cutting concerns (AI, proxy, queue, cache).
- **Lucid ORM** for all DB access; migrations in `database/migrations/`.
- **Queue system**: Use filesystem queues for async LLM jobs; see `queue_service.ts`.
- **Tests**: Place unit/functional tests in `tests/`, LLM integration in `tests/llm-integration/`.
- **2-space indentation** (no tabs).
- **Commits/messages**: English or Portuguese, descriptive.

## Integration & External Dependencies
- **Ollama LLM**: Configure via `OLLAMA_URL`, `OLLAMA_MODEL` env vars. Enable/disable with `ENABLE_OLLAMA`.
- **Proxy**: Main logic in `proxy_controller.ts` and `proxy_request_service.ts`.
- **Cache**: LLM and proxy caches use SHA-256 keys and configurable TTLs.
- **Docker**: See `README.md` for compose setup. Use `APP_KEY` generated via `node ace generate:key`.

## Examples
- Add a new service: Place in `app/services/`, export as default, inject via controller.
- Add a migration: Place in `database/migrations/`, run with `npm run migr`.
- Add a test: Place in `tests/`, use Japa syntax.

## References
- See `README.md` for user/deployment info.
- See `README-dev.md` for dev setup, scripts, and architecture.
- See `CONTRIBUTING.md` for code style and PR workflow.

---
For questions, see [GitHub Issues](https://github.com/vinicioslc/localizarr/issues) or [Telegram](https://t.me/vinicioslc).
