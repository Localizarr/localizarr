---
description: Pipeline de importação de dados do IMDb via Seeder
---

# Plano de Implementação: Importação de Dados do IMDb (TSV Compressed)

Este plano detalha como criar um Seeder no AdonisJS que baixa, descompacta e importa o dataset `title.basics.tsv.gz` do IMDb para o banco de dados SQLite.

## Estratégia Geral

Utilizaremos Node.js Streams para processar o arquivo linha por linha, garantindo eficiência de memória. Os dados serão inseridos em lotes (batches) para otimizar a performance de I/O no banco de dados.

## 1. Pré-requisitos e Dependências

Bibliotecas necessárias (nativas do Node.js ou comuns):

- `axios`: Para baixar o arquivo.
- `zlib`: Para descompactar o .gz (nativo).
- `fs`: Para manipulação de arquivos (nativo).
- `readline`: Para ler o arquivo linha por linha (nativo).

```bash
npm install axios
```

## 2. Estrutura do Seeder

Criar um novo arquivo seeder `src/database/seeders/imdb_import_seeder.ts`.

### Constantes e Configurações

- **URL**: `https://datasets.imdbws.com/title.basics.tsv.gz`
- **PATH TEMP**: `tmp/title.basics.tsv.gz`
- **BATCH_SIZE**: 1000 (ajustável para performance vs memória)

### Fluxo de Execução (`run()`)

1.  **Verificação e Download**:
    - Verificar se o arquivo já existe em `tmp/`.
    - Se não existir, iniciar download via `axios` (responseType: 'stream') e salvar em disco.
    - Exibir barra de progresso ou logs simples (opcional, mas recomendado para arquivos grandes).

2.  **Leitura e Processamento (Streaming)**:
    - Criar `fs.createReadStream` do arquivo baixado.
    - Conectar via pipe ao `zlib.createGunzip()` para descompactar em tempo real.
    - Conectar ao `readline.createInterface` para iterar linha por linha.

3.  **Parsing e Mapeamento**:
    - **Header**: Ler a primeira linha para identificar colunas (ou ignorar se a estrutura for fixa: `tconst`, `titleType`, `primaryTitle`, `originalTitle`, `isAdult`, `startYear`, `endYear`, `runtimeMinutes`, `genres`).
    - **Filtragem**:
      - Ignorar `isAdult === 1` (opcional, mas comum).
      - Filtrar `titleType` relevante (ex: `movie`, `tvSeries`, `tvMiniSeries`) para economizar espaço se necessário.
    - **Tratamento de Nulos**: Substituir `\N` por `null` ou string vazia.
    - **Mapeamento para DB** (`Title` Model):
      - `tconst` -> `imdb_id`
      - `titleType` -> `media_type`
      - `originalTitle` -> `original_title`
      - Objeto completo -> `imdb_data` (JSON)

4.  **Inserção em Lote (Batch Insert)**:
    - Acumular registros processados em um array `batch`.
    - Quando `batch.length >= BATCH_SIZE`:
      - Executar `Title.createMany(batch)` ou `db.table('titles').multiInsert(batch)`.
      - Limpar o array.
    - Ao final do arquivo, inserir os registros restantes.

## 3. Otimizações de Banco de Dados

- **Desativar Logs de Query**: Durante a importação massiva, logs do Lucid/Adonis podem estourar a memória. Usar `client.on('query', ...)` somente se necessário ou garantir que o logger esteja em nível baixo.
- **Transações**: Embora o `createMany` já seja otimizado, se o SQLite travar, considerar envolver chunks maiores em transações manuais.

## 4. Exemplo de Código (Esboço)

```typescript
// Imports...
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Title from '#models/title'
import axios from 'axios'
import zlib from 'zlib'
import fs from 'fs'
import readline from 'readline'

export default class extends BaseSeeder {
  // Configs
  private url = 'https://datasets.imdbws.com/title.basics.tsv.gz'
  private filePath = 'tmp/title.basics.tsv.gz'
  private batchSize = 1000

  async run() {
    await this.downloadFileIfNotExists()
    await this.processAndImport()
  }

  // ... métodos downloadFileIfNotExists e processAndImport
}
```

## 5. Próximos Passos

1. Execute `npm install axios` se ainda não estiver instalado.
2. Crie o arquivo do seeder.
3. Execute `node ace db:seed` para testar.
