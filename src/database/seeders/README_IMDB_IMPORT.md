# Importação de Dados do IMDb

## 📋 Visão Geral

Este seeder baixa e importa automaticamente o dataset completo de títulos do IMDb (`title.basics.tsv.gz`) para o banco de dados SQLite.

## 🚀 Como Usar

### 1. Executar o Seeder

```bash
node ace db:seed --files=database/seeders/imdb_import_seeder.ts
```

### 2. O que acontece:

1. **Download Automático**: Se o arquivo não existir em `tmp/title.basics.tsv.gz`, será baixado automaticamente (~250MB compactado)
2. **Descompactação em Stream**: O arquivo é descompactado em tempo real usando `zlib`
3. **Parsing Otimizado**: Usa `csv-parser` para processar o TSV linha por linha
4. **Filtragem Inteligente**:
   - Apenas filmes (`movie`) e séries de TV (`tvSeries`, `tvMiniSeries`)
   - Exclui conteúdo adulto (`isAdult === 1`)
5. **Inserção em Lotes**: Insere 1000 registros por vez para otimizar performance

## 📊 Dados Importados

Cada título contém:
- **imdb_id**: ID único do IMDb (ex: `tt0468569`)
- **media_type**: `movie` ou `tv`
- **original_title**: Título original
- **imdb_data**: JSON com dados adicionais:
  - `primaryTitle`: Título principal
  - `startYear`: Ano de lançamento
  - `endYear`: Ano final (para séries)
  - `runtimeMinutes`: Duração
  - `genres`: Gêneros

## ⚡ Performance

- **Processamento em Stream**: Não carrega o arquivo inteiro na memória
- **Batch Insert**: Insere 1000 registros por vez
- **Tempo estimado**: ~10-30 minutos dependendo do hardware
- **Registros esperados**: ~10 milhões (filtrados para ~2-3 milhões)

## 🔧 Configurações

Você pode ajustar no arquivo `imdb_import_seeder.ts`:

```typescript
private batchSize = 1000  // Tamanho do lote (aumentar se tiver muita RAM)
```

## 📝 Notas

- O arquivo baixado fica em `tmp/title.basics.tsv.gz` e pode ser reutilizado
- Se o seeder falhar no meio, você pode executá-lo novamente (duplicatas serão ignoradas)
- Para limpar e reimportar: delete o arquivo `tmp/title.basics.tsv.gz` e execute novamente
