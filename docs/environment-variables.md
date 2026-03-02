# Variáveis de Ambiente

Este documento lista todas as variáveis de ambiente disponíveis no Localizarr com descrições detalhadas.

## Aplicação

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `APP_NAME` | `Localizarr` | Nome da aplicação para logs |
| `PORT` | `5005` | Porta principal do servidor HTTP |
| `HOST` | `0.0.0.0` | Endereço para bind do servidor |
| `LOG_LEVEL` | `info` | Nível de log (error, warn, info, debug) |
| `APP_KEY` | *obrigatório* | Chave para criptografia (gere com `node ace generate:key`) |
| `API_KEY` | - | Chave opcional para autenticação de API |
| `NODE_ENV` | `development` | Ambiente (development, production, test) |
| `SESSION_DRIVER` | `cookie` | Driver de sessão |

## Banco de Dados

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DB_CONNECTION` | `sqlite` | Tipo de conexão do banco |

## Proxy

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PROXY_PORT` | `5006` | Porta do servidor proxy TCP |

## Processamento de Títulos (Ollama)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `ENABLE_OLLAMA` | `true` | Habilita/desabilita processamento via LLM |
| `USE_QUEUED_LLM` | `false` | Usa filas para processamento LLM (melhor para hardware limitado) |
| `ENABLE_QUEUE_PROCESSING` | `true` | Habilita consumo de mensagens da fila |
| `LLM_CACHE_EXPIRY_SECONDS` | `3600` | TTL do cache de respostas LLM (1 hora) |

### Modos de Processamento

- **Síncrono** (`USE_QUEUED_LLM=false`): Títulos processados imediatamente, bloqueando a resposta HTTP
- **Assíncrono** (`USE_QUEUED_LLM=true`): Títulos enfileirados para processamento em background
- **Processamento de Fila** (`ENABLE_QUEUE_PROCESSING=false`): Mensagens publicadas mas não consumidas (útil para debug)

## Servidor Ollama

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `OLLAMA_URL` | `http://localhost:11434` | URL completa do servidor Ollama |
| `OLLAMA_MODEL` | `qwen3:1.7b` | Modelo LLM para análise |

### Modelos Recomendados

| Modelo | Tamanho | Uso |
|--------|---------|-----|
| `qwen3:1.7b` | ~1.1GB | Hardware limitado |
| `gemma3:4b` | ~2.5GB | Equilíbrio |
| `llama3.1:8b` | ~4.9GB | Melhor precisão |

## Cache de Indexers

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `INDEXER_CACHE_SUCCESS_TTL_SECONDS` | `300` | TTL para respostas bem-sucedidas (5 min) |
| `INDEXER_CACHE_ERROR_TTL_SECONDS` | `60` | TTL para respostas com erro (1 min) |

## Stream/Heartbeat

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `STREAM_HEARTBEAT_TIMEOUT_MS` | `60000` | Timeout para heartbeat de stream (60s) |

## Exemplo .env

```bash
# Application
APP_NAME=Localizarr
PORT=5005
HOST=0.0.0.0
LOG_LEVEL=info
APP_KEY=sua-app-key-aqui
API_KEY=sua-api-key-opcional
NODE_ENV=production
SESSION_DRIVER=cookie

# Database
DB_CONNECTION=sqlite

# Proxy
PROXY_PORT=5006

# Ollama Processing
ENABLE_OLLAMA=true
USE_QUEUED_LLM=false
ENABLE_QUEUE_PROCESSING=true
LLM_CACHE_EXPIRY_SECONDS=3600

# Ollama Server
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:1.7b

# Cache
INDEXER_CACHE_SUCCESS_TTL_SECONDS=300
INDEXER_CACHE_ERROR_TTL_SECONDS=60

# Stream
STREAM_HEARTBEAT_TIMEOUT_MS=60000
```
