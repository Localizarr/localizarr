# Fluxo de Matching de Títulos e Contexto IMDb

Este documento explica como o Localizarr utiliza a Inteligência Artificial (LLM) combinada com dados estruturados do IMDb (via banco de dados local) para identificar e traduzir títulos de filmes e séries em resultados de busca de torrents, garantindo compatibilidade com Sonarr e Radarr.

## 🧠 Visão Geral

O sistema atua como um "proxy inteligente" entre os Indexers (Prowlarr/Jackett) e os arrs (Sonarr/Radarr). O fluxo principal é:

1. **Interceptação**: O Localizarr intercepta a busca ou o feed RSS.
2. **Identificação**: Extrai o ID do IMDb da requisição (se houver).
3. **Enriquecimento**: Busca metadados detalhados (ano, gênero, tipo) no banco de dados local.
4. **Análise via LLM**: Envia os resultados da busca + metadados para o Ollama.
5. **Tradução**: Mapeia nomes localizados (ex: "Pacificador") para o original em inglês (ex: "Peacemaker").
6. **Resposta**: Retorna os resultados modificados para o Sonarr/Radarr.

---

## 📊 Estrutura de Dados e Contexto (IMDb Data)

Para melhorar a precisão da IA, utilizamos a coluna `imdb_data` (JSON) da tabela `titles`. Esses dados são importados via `imdb_import_seeder.ts` a partir dos datasets oficiais do IMDb.

### Estrutura do JSON (`ImdbMetadata`)

```typescript
interface ImdbMetadata {
  primaryTitle: string      // Título principal no IMDb
  titleType: string         // movie, tvSeries, tvMiniSeries, etc.
  startYear: string | null  // Ano de lançamento
  endYear: string | null    // Ano de término (para séries)
  runtimeMinutes: string | null // Duração
  genres: string | null     // Gêneros (ex: Action, Comedy)
}
```

### Contexto Gerado para o LLM

Quando o sistema encontra dados no banco, ele gera um bloco de contexto explicícito para o prompt do Ollama. Isso resolve ambiguidades (ex: filmes com mesmo nome em anos diferentes).

**Exemplo de Contexto Gerado:**

```text
TITLE INFO FROM IMDB:
- Primary Title: "Peacemaker"
- Type: tvSeries
- Year: 2022
- Genres: Action, Adventure, Comedy
- Runtime: 40 min
```

---

## 🤖 Prompt Engineering

O prompt enviado para o Ollama é construído dinamicamente para maximizar a taxa de acerto.

### Estrutura do Prompt

1. **Instrução Principal**: "ANALYZE THESE SEARCH TITLES..."
2. **Contexto IMDb**: O bloco gerado acima (se disponível).
3. **ID IMDb**: O ID "ttXXXXXX" para referência.
4. **Resultados da Busca**: Lista limitada (max 2000 chars) dos títulos encontrados nos torrents.
5. **Exemplos Dinâmicos**: O sistema extrai exemplos dos próprios resultados para ensinar a IA.
6. **Instruções Críticas**: Regras rígidas para priorizar o título inglês.

### Exemplo de Prompt Real

```text
ANALYZE THESE SEARCH TITLES: Identify the ORIGINAL ENGLISH title and its TRANSLATIONS.

TITLE INFO FROM IMDB:
- Primary Title: "The Boys"
- Type: tvSeries
- Year: 2019
- Genres: Action, Comedy, Crime

IMDb ID: tt1190634
REAL ORIGINAL TITLE: "The Boys"

SEARCH RESULTS TO ANALYZE:
1. "The.Boys.S03E01.Os.Garotos.1080p..."
2. "Os Garotos S03E01 Dual Audio..."
3. "The Boys S03E01..."

CRITICAL INSTRUCTIONS:
...
3. If you have valid IMDb info above, USE IT as the authoritative source
...
```

---

## 🔄 Fluxo de Decisão (Cache vs Live)

O sistema possui um mecanismo inteligente de cache para evitar chamadas desnecessárias ao LLM e ao banco de dados:

1. **Verificação de Cache**: O sistema verifica se já possui traduções armazenadas para aquele título (`localized_names`).
2. **Validação de "Suspeita"**: Se o título armazenado parecer uma tradução (ex: o título original no banco é "Pacificador" em vez de "Peacemaker"), o sistema força uma nova análise via LLM para corrigir.
3. **Fallback**: Se o LLM falhar ou não retornar um JSON válido, o sistema tenta identificar o título mais comum estatisticamente nos resultados.

## 🚀 Como Testar

Para verificar se o contexto está sendo usado corretamente:

1. Certifique-se de ter rodado o seeder: `node ace db:seed --files=database/seeders/imdb_import_seeder.ts`
2. Faça uma requisição para uma rota de proxy com um ID IMDb válido (ex: `/prowlarr/tt14144906?q=Pacificador`).
3. Verifique os logs do sistema. Você deverá ver:
   - `[OllamaService] Using cached data for tt14144906`
   - O prompt gerado contendo `TITLE INFO FROM IMDB`.
