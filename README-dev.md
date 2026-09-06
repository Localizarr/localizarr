# Localizarr - Developer Documentation

This document contains technical information for developers contributing to Localizarr.

## 🛠 Tech Stack

- **Backend**: Node.js 18+, TypeScript, AdonisJS
- **Frontend**: Svelte 4, SvelteKit
- **Database**: SQLite with Lucid ORM
- **AI**: Ollama integration
- **Testing**: Japa test runner
- **Queues**: Filesystem-based message queues

## 🚀 Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Ollama (for AI features)

### Installation

```bash
# Clone the repository
git clone https://github.com/vinicioslc/localizarr.git
cd localizarr

# Install dependencies
npm install

# Generate app key (in backend directory)
cd backend && node ace generate:key

# Run migrations
cd backend && npm run migr

# Start development server (from root)
npm run dev
```

### Available Scripts

```bash
# Development (Monorepo)
npm run dev          # Start all services
npm run build        # Build all packages

# Backend
cd backend && npm run dev          # Start development server with hot reload
cd backend && npm run build        # Build for production

# Database
cd backend && npm run migr         # Run migrations
cd backend && npm run seed         # Run seeders

# Testing
cd backend && npm run test          # Unit tests
cd backend && npm run test:functional  # Functional tests

# Frontend
cd frontend-svelte && npm run dev   # Start dev server
cd frontend-svelte && npm run test  # Run tests
```

## 🎬 IMDb Titles Import

Localizarr uses IMDb title data for movie/TV show identification and localization. The system provides several commands to manage title data:

### Import Commands

```bash
# Import titles (only if database is empty)
npm run import:titles

# Force re-import titles (deletes existing data first)
npm run import:titles:force

# Or use ace commands directly
node ace import:titles
node ace import:titles:force --confirm
```

### Force Import Interactive Options

When running `import:titles:force`, the command will ask two questions:

1. **Data Deletion Confirmation**: Confirms you want to delete all existing titles
2. **Fresh TSV Download**: Asks if you want to download a fresh TSV file from IMDb

```bash
# Skip all confirmations (dangerous - use with caution)
node ace import:titles:force --confirm

# Interactive mode (recommended)
node ace import:titles:force
```

### What the Import Does

1. **Downloads** the latest `title.basics.tsv.gz` file from IMDb datasets (~1.2GB compressed)
2. **Extracts** and processes the TSV data
3. **Imports** movie and TV show titles into the SQLite database
4. **Optimizes** the data for fast lookups during proxy requests

### Import Behavior

- `import:titles`: Safe import - only runs if database has fewer than 5 titles
- `import:titles:force`: Dangerous - deletes all existing titles before importing fresh data
- The import process can take 10-30 minutes depending on your hardware
- Progress is displayed during download and processing phases

### Data Source

- **URL**: <https://datasets.imdbws.com/title.basics.tsv.gz>
- **Size**: ~1.2GB compressed, ~4GB uncompressed
- **Update Frequency**: IMDb updates this dataset regularly
- **Storage**: Downloaded to `tmp/title.basics.tsv.gz`

## 📁 Project Structure

```
localizarr/
├── backend/                    # AdonisJS API server
│   ├── app/
│   │   ├── controllers/        # API controllers
│   │   │   ├── proxy_controller.ts
│   │   │   ├── titles_controller.ts
│   │   │   └── logs_controller.ts
│   │   ├── services/          # Business logic services
│   │   │   ├── ollama_service.ts
│   │   │   ├── queue_service.ts
│   │   │   ├── proxy_request_service.ts
│   │   │   └── title_matching_service.ts
│   │   ├── models/            # Database models
│   │   ├── middleware/       # HTTP middleware
│   │   └── repositories/     # Data access layer
│   ├── config/               # Configuration files
│   ├── database/
│   │   ├── migrations/       # Schema migrations
│   │   └── seeders/          # Data seeders
│   ├── start/
│   │   ├── routes.ts         # API routes
│   │   └── kernel.ts        # HTTP kernel
│   └── tests/
│       ├── unit/             # Unit tests
│       └── functional/       # Integration tests
├── frontend-svelte/          # SvelteKit frontend
│   ├── src/
│   │   └── routes/          # SvelteKit routes
│   └── tests/                # Vitest tests
└── package.json              # Monorepo root
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `ENABLE_OLLAMA`: Enable/disable AI processing
- `OLLAMA_URL`: Ollama server URL
- `USE_QUEUED_LLM`: Enable async processing
- `DB_CONNECTION`: Database type (SQLite by default)

### Database Schema

The application uses SQLite with the following main tables:

- `titles`: Core title information
- `localized_names`: Translation mappings
- `execution_logs`: Request/response logs
- `llm_caches`: AI response caching

## 🧪 Testing

### Test Structure

- **Backend**: Japa test runner
  - Unit: `tests/unit/`
  - Functional: `tests/functional/`
- **Frontend**: Vitest
  - Tests in `tests/` directory

### Running Tests

```bash
# Backend tests
cd backend && npm run test              # Unit
cd backend && npm run test:functional   # Functional
cd backend && npm run test:all         # All

# Frontend tests
cd frontend-svelte && npm run test
```

### Test Environment

Tests use a separate SQLite database and mock external services where possible.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages

### Areas for Contribution

- LLM processing improvements
- Additional language support
- Queue system enhancements
- Performance optimizations
- New indexer integrations
- UI/UX improvements

## 🔍 Debugging

### Logs

- Application logs: Check console output or `storage/logs/`
- Execution logs: Available via web UI at `/logs`
- Queue logs: Check `queues/` directory

### Common Issues

- **Ollama connection**: Ensure Ollama is running and accessible
- **Queue processing**: Check `ENABLE_QUEUE_PROCESSING` setting
- **Database issues**: Run `cd backend && npm run reset:db`

## 📚 API Documentation

### Main Endpoints

- `GET /`: Dashboard (SvelteKit frontend)
- `POST /api/proxy`: Proxy requests (internal)
- `GET /api/titles`: List titles
- `GET /logs`: View execution logs

### Title Management

- `GET /api/titles/:id`: Get title details
- `GET /api/titles/:id/localized-names`: Get translations
- `DELETE /api/titles/clear-all`: Clear all translations

## 🔒 Security

- API key authentication for sensitive operations
- Input validation on all endpoints
- SQL injection protection via Lucid ORM
- XSS protection via Svelte

## 📈 Performance

- LLM response caching (configurable TTL)
- Database query optimization
- Async processing for heavy operations
- Memory-efficient streaming for large responses

## 🔄 Deployment

### Docker

```yaml
# See docker-compose.yml for production setup
version: '3.8'
services:
  localizarr:
    image: vinicioslc/localizarr:latest
    ports:
      - "5005:5005"
      - "5006:5006"
    environment:
      - NODE_ENV=production
```

### Manual

```bash
# Build and start
npm run build
cd backend && npm run start
```

## 📞 Support

- [GitHub Issues](https://github.com/vinicioslc/localizarr/issues)
- [Telegram Community](https://t.me/vinicioslc)
