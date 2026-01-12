# Localizarr - Developer Documentation

This document contains technical information for developers contributing to Localizarr.

## 🛠 Tech Stack

- **Backend**: Node.js 18+, TypeScript, AdonisJS
- **Frontend**: Vue.js 3, Inertia.js
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

# Copy environment file
cp .env.example .env

# Generate app key
node ace generate:key

# Run migrations
npm run migr

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run migr         # Run migrations
npm run migr:rollback # Rollback migrations
npm run seed         # Run seeders

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Utilities
npm run reset:db     # Reset database (rollback + migrate + seed)
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 📁 Project Structure

```
localizarr/
├── app/                    # Application code
│   ├── controllers/        # API controllers
│   │   ├── proxy_controller.ts    # Main proxy logic
│   │   ├── titles_controller.ts   # Title management
│   │   └── logs_controller.ts     # Execution logs
│   ├── services/           # Business logic services
│   │   ├── ollama_service.ts      # AI/LLM integration
│   │   ├── queue_service.ts       # Queue management
│   │   └── proxy_request_service.ts # HTTP proxy logic
│   ├── models/             # Database models
│   │   ├── title.ts               # Title entity
│   │   ├── localized_name.ts      # Translation mappings
│   │   ├── execution_log.ts       # Request logs
│   │   └── llm_cache.ts           # AI response cache
│   ├── repositories/       # Data access layer
│   │   └── titles_service.ts      # Title processing logic
│   └── middleware/         # HTTP middleware
├── config/                 # Configuration files
│   ├── app.ts              # Main app config
│   ├── database.ts         # Database config
│   └── session.ts          # Session config
├── database/               # Database files
│   ├── migrations/         # Schema migrations
│   └── seeders/            # Data seeders
├── inertia/                # Frontend (Vue.js + Inertia)
│   ├── pages/              # Vue components/pages
│   └── css/                # Styles
├── queues/                 # Filesystem queue storage
├── start/                  # Application bootstrap
│   ├── routes.ts           # API routes
│   ├── env.ts              # Environment validation
│   └── kernel.ts           # HTTP kernel
├── tests/                  # Test suites
│   ├── functional/         # API integration tests
│   ├── llm-integration/    # AI integration tests
│   └── bootstrap.ts        # Test setup
├── tmp/                    # Temporary files
└── resources/              # Static assets
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

- **Unit Tests**: Individual functions and services
- **Functional Tests**: API endpoints and integrations
- **LLM Integration Tests**: AI processing validation

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# Specific test file
npm test tests/functional/proxy_controller.spec.ts
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
- **Database issues**: Run `npm run reset:db`

## 📚 API Documentation

### Main Endpoints

- `GET /`: Dashboard
- `POST /api/proxy`: Proxy requests (internal)
- `GET /api/titles`: List titles
- `GET /logs`: View execution logs

### Title Management

- `GET /api/titles/:id/localized-names`: Get translations
- `DELETE /api/titles/clear-all`: Clear all translations

## 🔒 Security

- API key authentication for sensitive operations
- Input validation on all endpoints
- SQL injection protection via Lucid ORM
- XSS protection via Vue.js

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
    build: .
    ports:
      - "5005:5005"
    environment:
      - NODE_ENV=production
```

### Manual

```bash
npm run build
npm run start
```

## 📞 Support

- [GitHub Issues](https://github.com/vinicioslc/localizarr/issues)
- [Telegram Community](https://t.me/vinicioslc)
