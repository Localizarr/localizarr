# Localizarr

An intelligent AI-powered proxy that solves localization issues in Sonarr, Radarr, Lidarr, and Readarr. Automatically identifies and translates foreign language titles using Ollama LLM, ensuring your media library matches localized releases perfectly, we achieve acceptable results with LLM gemma3:4b

![Localizarr Logo](image/README/1759795301449.png)

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

### 🛠 Developer-Friendly

- **Modern Tech Stack**: Node.js, TypeScript, AdonisJS, Vue.js
- **RESTful API**: Clean API endpoints for integrations
- **SQLite Database**: Lightweight, file-based database
- **Comprehensive Testing**: Unit, functional, and LLM integration tests

## 🚀 Quick Start

### Docker (Recommended)

```yaml
version: '3.8'
services:
  localizarr:
    image: vinicioslc/localizarr:latest
    ports:
      - "5005:5005"  # Main application
      - "5006:5006"  # Prowlarr proxy
    environment:
      - ENABLE_OLLAMA_PROCESSING=true
      - OLLAMA_HOST=host.docker.internal
      - OLLAMA_PORT=11434
    volumes:
      - ./data:/app/data

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ./ollama:/root/.ollama
```

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

**Example:**

```text
Input:  "Pacificador.S02E04.1080p.WEB-DL.DUAL.5.1"
Output: "Peacemaker.S02E04.1080p.WEB-DL.DUAL.5.1"
```

## 🛠 For Developers

### Tech Stack

- **Backend**: Node.js 18+, TypeScript, AdonisJS
- **Frontend**: Vue.js 3, Inertia.js
- **Database**: SQLite with Lucid ORM
- **AI**: Ollama integration
- **Testing**: Japa test runner

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Reset database
npm run reset:db
```

### Project Structure

```text
localizarr/
├── app/                 # Application code
│   ├── controllers/     # API controllers
│   ├── services/        # Business logic
│   └── models/         # Database models
├── tests/              # Test suites
│   ├── functional/     # API tests
│   └── llm-integration/ # AI integration tests
├── database/           # Migrations & seeders
└── resources/          # Frontend assets
```

### Contributing

We welcome contributions! Check out our [contributing guide](CONTRIBUTING.md) to get started.

**Areas for contribution:**

- LLM processing improvements
- Additional language support
- UI/UX enhancements
- Performance optimizations
- New indexer integrations

## 📞 Support & Community

- [GitHub Issues](https://github.com/vinicioslc/localizarr/issues)
- [Telegram](https://t.me/vinicioslc)

## 🙏 Acknowledgments

Special thanks to the **UmlautAdaptarr** project for inspiring this localization solution and demonstrating the power of AI in media management workflows.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
