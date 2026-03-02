# Sistema de Filas

O Localizarr utiliza um sistema de mensagens baseado em arquivos para processar títulos de forma assíncrona, reduzindo a latência em requisições HTTP e permitindo processamento em background.

## Visão Geral

O sistema de filas permite:
- Processamento assíncrono de títulos via LLM
- Melhora de performance em hardware limitado
- Tolerância a falhas com retries automáticos
- Logging de processamento

## Tópicos de Fila

Defined in `queues.ts`:

```typescript
export const QUEUES = {
  PROCESS_RESPONSE_WITH_OLLAMA: 'process-response-with-ollama',
  PROCESS_TITLES_ASYNC: 'process-titles-async',
}
```

### PROCESS_TITLES_ASYNC

Usado para processar títulos de forma assíncrona. Quando habilitado (`USE_QUEUED_LLM=true`):

1. Requisição é recebida e respondida imediatamente
2. Dados são publicados na fila `process-titles-async`
3. Consumidor processa em background:
   - Extrai títulos da resposta
   - Envia para Ollama
   - Armazena traduções no banco
   - Aplica replacements na próxima requisição

### PROCESS_RESPONSE_WITH_OLLAMA

Fila para processamento direto de respostas com LLM (reservado para uso futuro).

## Arquitetura

```
                    ┌─────────────────┐
                    │   Requisição    │
                    │     HTTP        │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    USE_QUEUED_LLM=false            USE_QUEUED_LLM=true
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  Processamento  │           │    Publicar     │
    │    Síncrono     │           │     na Fila    │
    │  (bloqueante)   │           └────────┬────────┘
    └────────┬────────┘                    │
             │                              ▼
             │                   ┌─────────────────┐
             │                   │  tmp/queues/    │
             │                   │  (arquivos)     │
             │                   └────────┬────────┘
             │                              │
             │                   ┌──────────┴──────────┐
             │                   │   Consumidor (5s)    │
             │                   │  - LLM processing   │
             │                   │  - Store results    │
             │                   │  - Apply replac.    │
             │                   └─────────────────────┘
             ▼
    ┌─────────────────┐
    │    Resposta     │
    │     HTTP        │
    └─────────────────┘
```

## Configuração

Variáveis de ambiente relacionadas:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `USE_QUEUED_LLM` | `false` | Habilita processamento assíncrono |
| `ENABLE_QUEUE_PROCESSING` | `true` | Habilita consumidor de filas |
| `LLM_CACHE_EXPIRY_SECONDS` | `3600` | TTL do cache LLM |

## Formato de Arquivos

Arquivos de fila são armazenados em `tmp/queues/`:

```
tmp/queues/
├── process-titles-async-1700000000-abc123-pending.json
├── process-titles-async-1700000001-def456-pending.json
├── process-titles-async-1700000000-abc123-finished.json
└── process-titles-async-1700000002-ghi789-failed.json
```

### Ciclo de Vida

1. **pending**: Mensagem aguardando processamento
2. **finished**: Processamento concluído com sucesso
3. **failed**: Processamento falhou (para debugging)

### Estrutura da Mensagem

```json
{
  "responseData": { ... },
  "imdbId": "tt1234567",
  "executionLogId": 123
}
```

## Implementação

Serviço principal: `app/services/queue_service.ts`

```typescript
// Publicar mensagem
const queue = QueueService.getInstance()
await queue.publish(QUEUES.PROCESS_TITLES_ASYNC, {
  responseData: { ... },
  imdbId: 'tt1234567',
  executionLogId: 123
})

// Consumir mensagem
queue.subscribe(QUEUES.PROCESS_TITLES_ASYNC, async (finish, data) => {
  await processTitles(data)
  await finish() // Move para finished
})
```

## Debug

Rota de debug disponível em desenvolvimento:

```
GET /__debug/publish-queue?topic=process-titles-async&payload={"test":"data"}
```

## Troubleshooting

### Filas não são processadas

1. Verificar `ENABLE_QUEUE_PROCESSING=true`
2. Verificar logs em `tmp/queues/`
3. Checar consumidor está rodando

### Mensagens repetidamente falham

1. Arquivos são movidos para `*-failed.json`
2. Verificar logs de erro
3. Corrigir problema e re-publicar mensagem
