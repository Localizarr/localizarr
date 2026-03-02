# Referência da API

Este documento lista todos os endpoints da API do Localizarr.

## Endpoints Públicos

### Dashboard

```
GET /
```

Retorna a página principal com lista de títulos.

**Response**: HTML (Inertia)

---

### Logs de Execução

```
GET /logs
```

Retorna página de logs de execução do proxy.

**Query Params**:
| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| page | 1 | Página atual |
| limit | 20 | Itens por página (10-100) |

**Response**: HTML (Inertia)

---

## Endpoints de Proxy

### Proxy HTTP

```
ANY /_/:domain/*
```

Rota coringa que proxy todas as requisições para o indexer especificado.

**Exemplos**:
- `GET /_/torrentio.strem.fun/api/v3/search?type=tv`
- `POST /_/rarbg.com/api/v2/torrent/filter`

**Headers**:
| Header | Descrição |
|--------|-----------|
| X-Proxy-Cache | HIT ou MISS |

---

### Teste de Proxy

```
POST /test-proxy
```

Endpoint para testar configuração do proxy.

---

## Endpoints de API REST

### Listar Títulos

```
GET /api/titles
```

Lista todos os títulos com traduções.

**Query Params**:
| Parâmetro | Descrição |
|-----------|-----------|
| search | Busca por título original ou traduzido |
| lang | Filtrar por idioma (ex: pt-BR) |
| page | Página para paginação |
| limit | Itens por página |

**Response**:
```json
{
  "success": true,
  "data": {
    "meta": { "current_page": 1, "total": 50 },
    "data": [
      {
        "id": 1,
        "imdbId": "tt1234567",
        "originalTitle": "Peacemaker",
        "mediaType": "tv",
        "localizedNames": [
          { "id": 1, "langId": "pt-BR", "localizedName": "Pacificador" }
        ]
      }
    ]
  }
}
```

---

### Criar Título

```
POST /api/titles
```

Cria um novo título com tradução.

**Body**:
```json
{
  "originalTitle": "Peacemaker",
  "imdbId": "tt1234567",
  "mediaType": "tv",
  "langId": "pt-BR",
  "localizedName": "Pacificador"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": { "id": 1, "originalTitle": "Peacemaker" }
}
```

---

### Listar Traduções de um Título

```
GET /api/titles/:id/localized-names
```

Retorna todas as traduções de um título específico.

**Response**:
```json
{
  "success": true,
  "data": [
    { "id": 1, "langId": "pt-BR", "localizedName": "Pacificador" }
  ]
}
```

---

### Adicionar Tradução

```
POST /api/titles/:id/localized-names
```

Adiciona uma nova tradução a um título existente.

**Body**:
```json
{
  "langId": "pt-BR",
  "localizedName": "Pacificador"
}
```

**Response** (201):
```json
{
  "success": true,
  "data": { "id": 2, "langId": "pt-BR", "localizedName": "Pacificador" }
}
```

---

### Deletar Título

```
DELETE /api/titles/:id
```

Deleta um título e todas as suas traduções.

**Response**: Redirect para página anterior

---

### Deletar Tradução

```
DELETE /api/titles/:id/localized-names/:localizedNameId
```

Deleta uma tradução específica.

**Response**: Redirect para página anterior

---

### Limpar Todas as Traduções

```
DELETE /api/titles/clear-all
```

Remove todas as traduções do banco de dados (mantém títulos base).

**Response**: Redirect com mensagem de sucesso

---

## Endpoints de Debug (Desenvolvimento)

### Publicar na Fila

```
GET /__debug/publish-queue
```

Publica uma mensagem de teste na fila (apenas em desenvolvimento).

**Query Params**:
| Parâmetro | Descrição |
|-----------|-----------|
| topic | Tópico da fila (padrão: process-titles-async) |
| payload | JSON com dados da mensagem |

**Example**:
```
GET /__debug/publish-queue?topic=process-titles-async&payload={"test":"debug"}
```

**Response**:
```json
{
  "ok": true,
  "topic": "process-titles-async"
}
```

---

## Replay de Log

### Reenviar Requisição

```
POST /logs/:id/replay
```

Reexecuta uma requisição de log anterior.

**Response**: Redirect para /logs com resultado do replay

---

## Códigos de Status

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 404 | Não encontrado |
| 500 | Erro interno |

---

## Headers de Resposta

| Header | Descrição |
|--------|-----------|
| X-Proxy-Cache | HIT (cache) ou MISS (fetch fresco) |
| Content-Type | Tipo do conteúdo |
