# Localizarr - Architecture Documentation

## Overview

Localizarr is an intelligent AI-powered proxy that sits between *Arr applications (Sonarr, Radarr, Lidarr, Readarr) and indexers. Its main purpose is to identify and translate foreign language titles to their original English equivalents using Ollama LLM.

## System Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   *Arr      │      │  Localizarr │      │   Ollama    │      │  Indexer    │
│ Applications│──────│   Proxy     │──────│    LLM      │      │ (Prowlarr)  │
│             │      │             │      │             │      │             │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                           Request Flow                                   │
  │  1. *Arr searches for media                                            │
  │  2. Request hits Localizarr proxy (port 5006)                          │
  │  3. Proxy forwards to indexer via main app (port 5005)                 │
  │  4. Response analyzed for title translations                            │
  │  5. LLM identifies original English titles                            │
  │  6. Translated response returned to *Arr                                │
  └─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Proxy Server (`ProxyService`)

- **Location**: `backend/app/services/proxy_service.ts`
- **Port**: 5006 (configurable via `PROXY_PORT`)
- **Function**: TCP proxy that intercepts requests to indexers
- **Features**:
  - Supports CONNECT method for HTTPS tunneling
  - Basic proxy authentication
  - Forwards HTTP requests to main application for processing

### 2. Main Application Server

- **Location**: AdonisJS server
- **Port**: 5005 (configurable via `PORT`)
- **Routes**:
  - `/_/:domain/*` - Proxy forwarding route
  - `/api/proxy` - Main proxy API endpoint
  - `/api/titles` - Title management
  - `/logs` - Execution logs

### 3. Title Processing Pipeline

```
Indexer Response
       │
       ▼
┌──────────────────┐
│ UrlParserService │ ─── Parse content type (JSON/XML/RSS/HTML)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ TitleMatchingSvc  │ ─── Match titles with database
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Decision       │ ─── Use cached? Use LLM? Use database?
└────────┬─────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
┌───────┐ ┌───────┐  ┌──────────┐
│ Cache │ │  LLM  │  │ Database │
│ Check │ │ Call  │  │  Lookup  │
└───┬───┘ └───┬───┘  └────┬─────┘
    │         │            │
    └────────┴────────────┘
              │
              ▼
      Modified Response
```

## Services

### OllamaService

**Location**: `backend/app/services/ollama_service.ts`

Handles communication with Ollama LLM:

```typescript
interface OllamaService {
  // Analyze title to find original English equivalent
  analyzeTitle(title: string, year?: number): Promise<string | null>
  
  // Check cache before making LLM call
  getCachedResponse(prompt: string): Promise<string | null>
  
  // Cache LLM response
  cacheResponse(prompt: string, response: string): Promise<void>
}
```

**Cache Key**: SHA-256 hash of prompt
**Cache TTL**: Configurable via `LLM_CACHE_EXPIRY_SECONDS` (default: 3600s)

### QueueService

**Location**: `backend/app/services/queue_service.ts`

Filesystem-based message queue for async LLM processing:

```typescript
interface QueueService {
  // Add title to processing queue
  enqueue(titleId: number, locale: string): Promise<void>
  
  // Process queued titles
  processQueue(): Promise<void>
  
  // Check queue status
  getQueueStatus(): QueueStatus
}
```

**Processing Modes**:
- **Sync** (`USE_QUEUED_LLM=false`): Process immediately
- **Async** (`USE_QUEUED_LLM=true`): Queue for background processing

### ProxyRequestService

**Location**: `backend/app/services/proxy_request_service.ts`

Handles the actual HTTP proxy requests:

```typescript
interface ProxyRequestService {
  // Forward request to indexer
  forwardRequest(targetUrl: string, options: RequestOptions): Promise<ProxyResponse>
  
  // Modify response content
  processResponse(response: ProxyResponse, contentType: string): Promise<ProcessedResponse>
}
```

### UrlParserService

**Location**: `backend/app/services/url_parser_service.ts`

Parses and extracts parameters from proxy requests:

```typescript
interface UrlParserService {
  // Parse URL and extract parameters
  parseUrl(url: string): ParsedUrl
  
  // Determine content type
  getContentType(headers: Headers): ContentType
  
  // Parse response body based on content type
  parseBody(body: string, contentType: ContentType): ParsedBody
}
```

**Supported Content Types**:
- JSON (application/json)
- XML (application/xml, text/xml)
- RSS (application/rss+xml)
- HTML (text/html)

### TitleMatchingService

**Location**: `backend/app/services/title_matching_service.ts`

Matches and translates titles:

```typescript
interface TitleMatchingService {
  // Find translation for title
  findTranslation(title: string, type: 'movie' | 'tv'): Promise<Translation | null>
  
  // Get all localized names for a title
  getLocalizedNames(titleId: number): Promise<LocalizedName[]>
  
  // Store new translation
  storeTranslation(titleId: number, locale: string, name: string): Promise<void>
}
```

## Data Models

### Title

```typescript
interface Title {
  id: number
  imdb_id: string
  title: string
  type: 'movie' | 'tv'
  year: number
  created_at: DateTime
  updated_at: DateTime
}
```

### LocalizedName

```typescript
interface LocalizedName {
  id: number
  title_id: number
  locale: string      // e.g., 'pt-BR'
  name: string        // Translated name
  is_original: boolean
  created_at: DateTime
  updated_at: DateTime
}
```

### ExecutionLog

```typescript
interface ExecutionLog {
  id: number
  method: string      // HTTP method
  url: string        // Local URL
  target_url: string // Original target URL
  status_code: number
  response_time_ms: number
  host: string       // Target host
  created_at: DateTime
}
```

### LlmCache

```typescript
interface LlmCache {
  id: number
  cache_key: string  // SHA-256 of prompt
  prompt: string
  response: string
  created_at: DateTime
  expires_at: DateTime
}
```

### ProxyCache

```typescript
interface ProxyCache {
  id: number
  cache_key: string  // SHA-256 of URL + headers
  content_type: string
  body: Buffer
  created_at: DateTime
  expires_at: DateTime
}
```

## Request Flow Details

### 1. Incoming Request

```
*Arr App                    Localizarr Proxy               Indexer
    │                            │                           │
    │──── GET /api/v1/search ───▶│                           │
    │                            │                           │
    │                            │──── GET /api/v1/search ──▶│
    │                            │                           │
    │                            │◀─── Response (JSON) ─────│
    │                            │                           │
    │                            │ ▼                         │
    │                            │ Parse JSON                │
    │                            │ ▼                         │
    │                            │ For each title:           │
    │                            │   - Check cache           │
    │                            │   - Check database        │
    │                            │   - Call LLM if needed   │
    │                            │ ▼                         │
    │                            │ Translate titles          │
    │                            │ ▼                         │
    │◀─── Modified Response ────┤                           │
```

### 2. Title Translation Logic

```typescript
async function translateTitle(title: string): Promise<string> {
  // 1. Check local database (titles table)
  const dbMatch = await Title.findBy({ title })
  if (dbMatch) return dbMatch.title

  // 2. Check LLM cache
  const cached = await LlmCache.find(cacheKey)
  if (cached && !cached.isExpired()) return cached.response

  // 3. Call Ollama LLM
  const llmResponse = await ollama.analyzeTitle(title)
  
  // 4. Cache result
  await LlmCache.create({ cacheKey, response: llmResponse })
  
  return llmResponse
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5005 | Main application port |
| `PROXY_PORT` | 5006 | Proxy server port |
| `APP_KEY` | Required | AdonisJS encryption key |
| `ENABLE_OLLAMA` | true | Enable LLM processing |
| `USE_QUEUED_LLM` | false | Use async queue for LLM |
| `OLLAMA_URL` | http://localhost:11434 | Ollama server URL |
| `OLLAMA_MODEL` | qwen3:1.7b | LLM model name |
| `LLM_CACHE_EXPIRY_SECONDS` | 3600 | Cache TTL |

### Key Configuration Files

- `backend/config/app.ts` - Application configuration
- `backend/config/database.ts` - Database settings
- `backend/config/cors.ts` - CORS configuration

## Testing Strategy

### Unit Tests

Location: `backend/tests/unit/`

- Services tested in isolation
- Mock external dependencies (Ollama, database)
- Focus on business logic

### Functional Tests

Location: `backend/tests/functional/`

- End-to-end API testing
- Real HTTP requests
- Database operations

### Test Commands

```bash
# Backend
cd backend
npm run test              # Unit tests
npm run test:functional   # Functional tests
npm run test:all          # All tests

# Frontend
cd frontend-svelte
npm run test              # Vitest tests
```

## Deployment

### Docker Compose

```yaml
services:
  localizarr:
    ports:
      - "5005:5005"  # Main app
      - "5006:5006"  # Proxy
    environment:
      - APP_KEY=${APP_KEY}
      - OLLAMA_URL=http://ollama:11434
      - OLLAMA_MODEL=qwen3:1.7b
    depends_on:
      - ollama

  ollama:
    ports:
      - "11434:11434"
```

### Prowlarr Configuration

1. Add indexer to Prowlarr
2. Set URL to `http://localhost:5006` (or container IP)
3. Configure authentication if enabled

## Performance Considerations

1. **LLM Caching**: Reduces redundant API calls
2. **Proxy Caching**: Caches indexer responses
3. **Queue Processing**: Offloads LLM processing for better response times
4. **Database Indexing**: Optimized queries on titles table

## Security

1. **API Key Authentication**: Optional proxy authentication
2. **Input Validation**: All inputs validated via VineJS
3. **SQL Injection Protection**: Lucid ORM parameterization
4. **CORS**: Configurable cross-origin restrictions
