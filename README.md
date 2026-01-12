# Localizarr

An intelligent AI-powered proxy that solves localization issues in Sonarr, Radarr, Lidarr, and Readarr. Automatically identifies and translates foreign language titles using Ollama LLM, ensuring your media library matches localized releases perfectly, we achieve acceptable results with LLM gemma3:4b

![Localizarr Logo](image/README/logo.png)

## ✨ Key Features

### 🤖 AI-Powered Title Translation

- **Automatic Detection**: Uses Ollama LLM (gemma3:4b) to intelligently identify original English titles from localized search results
- **Smart Learning**: Dynamically learns and stores translations in database for future use
- **Multi-Language Support**: Currently focused on Brazilian Portuguese, extensible to other languages

### 🔄 Seamless Integration

- **Transparent Proxy**: Acts as a proxy between indexers and *Arr applications
- **Prowlarr Compatible**: Works with Prowlarr and NZB Hydra
- **Universal Support**: Compatible with Sonarr, Radarr, Lidarr, and Readarr

### ⚡ Performance & Caching

- **LLM Response Cache**: SHA-256 hashed caching prevents redundant API calls (1-hour TTL)
- **Smart Indexer Cache**: Automatic caching for any content-type (JSON, XML, RSS, HTML)
- **Configurable TTL**: Separate cache times for success/error responses
- **Flexible Processing**: Synchronous or asynchronous title processing via filesystem queues
- **Background Jobs**: Queue-based LLM analysis for improved performance on resource-constrained systems

## 🛠 Developer-Friendly

- **Modern Tech Stack**: Node.js, TypeScript, AdonisJS, Vue.js
- **RESTful API**: Clean API endpoints for integrations
- **SQLite Database**: Lightweight, file-based database
- **Comprehensive Testing**: Unit, functional, and LLM integration tests

## 🚀 Deploy with Docker Compose

```yaml
version: '3.8'
services:
  localizarr:
    image: vinicioslc/localizarr:latest
    container_name: localizarr
    ports:
      - "5005:5005"  # Main application port
      - "5006:5006"  # Prowlarr proxy port
    environment:
      # Application Configuration
      - APP_NAME=Localizarr
      - PORT=5005
      - HOST=0.0.0.0
      - LOG_LEVEL=info
      - APP_KEY=your-generated-app-key-here
      - API_KEY=your-optional-api-key-here
      - NODE_ENV=production
      - SESSION_DRIVER=cookie

      # Database Configuration
      - DB_CONNECTION=sqlite

      # Proxy Configuration
      - PROXY_PORT=5006

      # Ollama AI Processing Configuration
      - ENABLE_OLLAMA=true
      - USE_QUEUED_LLM=false
      - ENABLE_QUEUE_PROCESSING=true
      - LLM_CACHE_EXPIRY_SECONDS=3600

      # Ollama AI Server Configuration
      - OLLAMA_URL=http://ollama:11434
      - OLLAMA_MODEL=qwen3:1.7b
    volumes:
      - ./data:/app/data
    depends_on:
      - ollama
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - "11434:11434"
    volumes:
      - ./ollama:/root/.ollama
    restart: unless-stopped
```

### Setup Instructions

1. **Create docker-compose.yml** with the configuration above
2. **Generate APP_KEY**:

   ```bash
   docker run --rm vinicioslc/localizarr:latest node ace generate:key
   ```

   Copy the generated key to the `APP_KEY` environment variable.

3. **Start services**:

   ```bash
   docker-compose up -d
   ```

4. **Pull Ollama model** (first run):

   ```bash
   docker-compose exec ollama ollama pull qwen3:1.7b
   ```

5. **Access Localizarr** at `http://localhost:5005`

### ⚙️ Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `Localizarr` | Application name for logging |
| `PORT` | `5005` | Main application port |
| `HOST` | `0.0.0.0` | Host to bind the server |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `APP_KEY` | *Required* | Secret key for encryption (generate with `node ace generate:key`) |
| `API_KEY` | *Optional* | API key for authentication |
| `NODE_ENV` | `development` | Environment mode |
| `SESSION_DRIVER` | `cookie` | Session storage driver |
| `DB_CONNECTION` | `sqlite` | Database connection type |
| `PROXY_PORT` | `5006` | Port for Prowlarr proxy |
| `ENABLE_OLLAMA` | `true` | Enable/disable LLM-based title processing |
| `USE_QUEUED_LLM` | `false` | Use queues for LLM processing (recommended for low-end hardware) |
| `ENABLE_QUEUE_PROCESSING` | `true` | Enable/disable queue message processing |
| `LLM_CACHE_EXPIRY_SECONDS` | `3600` | Cache TTL for LLM responses (seconds) |
| `OLLAMA_URL` | `http://localhost:11434` | Full URL to Ollama server |
| `OLLAMA_MODEL` | `qwen3:1.7b` | LLM model to use for analysis |

1. **Access Localizarr** at `http://localhost:5005`

### ⚙️ Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `Localizarr` | Application name for logging |
| `PORT` | `5005` | Main application port |
| `HOST` | `0.0.0.0` | Host to bind the server |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) |
| `APP_KEY` | *Required* | Secret key for encryption (generate with `node ace generate:key`) |
| `API_KEY` | *Optional* | API key for authentication |
| `NODE_ENV` | `development` | Environment mode |
| `SESSION_DRIVER` | `cookie` | Session storage driver |
| `DB_CONNECTION` | `sqlite` | Database connection type |
| `PROXY_PORT` | `5006` | Port for Prowlarr proxy |
| `ENABLE_OLLAMA` | `true` | Enable/disable LLM-based title processing |
| `USE_QUEUED_LLM` | `false` | Use queues for LLM processing (recommended for low-end hardware) |
| `ENABLE_QUEUE_PROCESSING` | `true` | Enable/disable queue message processing |
| `LLM_CACHE_EXPIRY_SECONDS` | `3600` | Cache TTL for LLM responses (seconds) |
| `OLLAMA_URL` | `http://localhost:11434` | Full URL to Ollama server |
| `OLLAMA_MODEL` | `qwen3:1.7b` | LLM model to use for analysis |

### Processing Modes

- **Synchronous** (`USE_QUEUED_LLM=false`): Titles are processed immediately, blocking the HTTP response until LLM analysis completes
- **Asynchronous** (`USE_QUEUED_LLM=true`): Titles are queued for background processing, improving response times on low-end hardware. Translations become available on subsequent requests.
- **Queue Processing** (`ENABLE_QUEUE_PROCESSING=false`): Disables queue message processing. Messages can still be published but won't be consumed, useful for debugging or maintenance.

### Local Development

```bash
git clone https://github.com/vinicioslc/localizarr.git
cd localizarr
npm install
npm run dev
```

## 📋 How It Works

1. **Intercept**: Localizarr sits between your *Arr applications and indexers
2. **Analyze**: Uses AI to identify translations in search results
3. **Translate**: Automatically renames localized titles to their original English equivalents
4. **Cache**: Stores translations for faster future lookups

**Processing Modes:**

- **Synchronous**: Immediate LLM analysis, titles corrected in real-time
- **Asynchronous**: Background processing via queues, titles corrected on subsequent requests

**Example:**

```text
Input:  "Pacificador.S02E04.1080p.WEB-DL.DUAL.5.1"
Output: "Peacemaker.S02E04.1080p.WEB-DL.DUAL.5.1"
```

## Support & Community

- [GitHub Issues](https://github.com/vinicioslc/localizarr/issues)
- [Telegram](https://t.me/vinicioslc)

## 🙏 Acknowledgments

Special thanks to the **UmlautAdaptarr** project for inspiring this localization solution and demonstrating the power of AI in media management workflows.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**For Developers**: See [README-dev.md](README-dev.md) for technical documentation, development setup, and contribution guidelines.
