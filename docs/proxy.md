# Sistema de Proxy

O Localizarr implementa um proxy HTTP/TCP transparente que intercepta requisições entre indexers e aplicações *Arr, processando títulos para identificar e traduzir localizeações.

## Arquitetura

O sistema possui dois componentes de proxy:

### 1. Proxy TCP (Porta 5006)

Implementado em `app/services/proxy_service.ts`:
- Servidor TCP pura para traffic forwarding
- Suporta método CONNECT para HTTPS
- Autenticação opcional via Basic Auth
- Redireciona tráfego para o servidor AdonisJS local

### 2. Proxy HTTP (Rota /_/:domain/*)

Implementado em `app/controllers/proxy_controller.ts`:
- Processa requisições HTTP via AdonisJS
- Integra com sistema de cache e processamento de títulos
- Suporta múltiplos formatos de resposta (JSON, XML, RSS, HTML)

## Fluxo de Requisição

```
Prowlarr/Jackett                    Localizarr                      Indexer
     │                                   │                              │
     │  GET /api/v3/search?type=tv       │                              │
     │ ─────────────────────────────────► │                              │
     │                                   │                              │
     │                                   │  Verifica cache local        │
     │                                   │ ◄─────────────────────────   │
     │                                   │                              │
     │                                   │  Se não cacheado:           │
     │                                   │ ─────────────────────────►   │
     │                                   │                              │ Fetch
     │                                   │ ◄─────────────────────────   │
     │                                   │                              │
     │                                   │  Processa títulos (LLM)      │
     │                                   │ ◄─────────────────────────   │
     │                                   │                              │
     │  Resposta com títulos traduzidos  │                              │
     │ ◄──────────────────────────────── │                              │
     │                                   │                              │
```

## Roteamento

### Rota de Proxy

```
/_/:domain/*
```

Exemplos:
- `/_/torrentio.strem.fun/api/v3/search?type=tv` → `https://torrentio.strem.fun/api/v3/search?type=tv`
- `/_/rarbg.com/torrent/list?search=movie` → `https://rarbg.com/torrent/list?search=movie`

### Parsers de URL Suportados

| Indexer | Formato | Exemplo |
|---------|---------|---------|
| Torrentio | `/stream/series/tt13146488:2:7.json` | Séries com ID IMDb |
| Torrentio | `/stream/movie/tt0111161.json` | Filmes com ID IMDb |
| RARBG | Query params | TMDB IDs em parâmetros |

## Cache de Indexers

O sistema mantém cache das respostas dos indexers para reduzir latência e chamadas externas.

### Configuração

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `INDEXER_CACHE_SUCCESS_TTL_SECONDS` | `300` | Cache para respostas 2xx (5 min) |
| `INDEXER_CACHE_ERROR_TTL_SECONDS` | `60` | Cache para erros (1 min) |

### Cabeçalhos de Resposta

```
X-Proxy-Cache: HIT   # Resposta do cache
X-Proxy-Cache: MISS  # Fetch fresco do indexer
```

## Autenticação

### API Key (Opcional)

Configure `API_KEY` no arquivo `.env` para proteger o proxy:

```bash
API_KEY=sua-chave-secreta
```

O proxy exigirá autenticação Basic:
- Username: qualquer valor
- Password: a API_KEY configurada

### Configuração no Prowlarr

```
Host: http://localhost:5006
```

## Implementação

### ProxyRequestService

Serviço principal em `app/services/proxy_request_service.ts`:

```typescript
const result = await ProxyRequestService.proxyRequest(
  'https://indexer.com/api/search',
  'GET',
  null,
  { 'User-Agent': 'App/1.0' }
)

// Result
{
  data: { ... },           // Response body
  status: 200,             // HTTP status
  headers: { ... },         // Response headers
  fromCache: true | false  // Cache hit/miss
}
```

### ProxyService

Servidor TCP em `app/services/proxy_service.ts`:

```typescript
// Iniciar proxy na porta 5006
const proxy = new ProxyService(logger, config)
proxy.start(5006, 'optional-api-key')
```

## Troubleshooting

### Indexer retorna erro de SSL

O proxy avisa quando um indexer precisa ser configurado com HTTP (não HTTPS):

```
IMPORTANT! Indexer {host} needs to be set to http:// instead of https://
```

### Latência alta

1. Reduza `INDEXER_CACHE_SUCCESS_TTL_SECONDS` para cache mais agressivo
2. Habilite processamento assíncrono com `USE_QUEUED_LLM=true`
3. Verifique cache de LLM com `LLM_CACHE_EXPIRY_SECONDS`

### Proxy não responde

1. Verifique se a porta 5006 está acessível
2. Confirme que `PROXY_PORT=5006` está configurado
3. Cheque logs em `storage/logs/`

## Configuração de Indexers

### Prowlarr

1. Adicione indexer com Custom URL: `http://localhost:5006`
2. Não configure proxy nos indexers individuais
3. O Localizarr roteia para o indexer real

### Jackett

Configure Jackett para usar o Localizarr como upstream proxy.
