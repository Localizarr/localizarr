/**
 * Unit tests for OllamaService
 *
 * Ollama HTTP calls are fully stubbed via OllamaStub (nock).
 * No running Ollama instance is required.
 *
 * IMPORTANT: The test DB is seeded with a few titles (e.g. tt14144906 = Peacemaker).
 * Tests that must exercise the LLM path use synthetic IMDb IDs (tt99100001 etc.)
 * that are guaranteed to be absent from the seed data, so DB-cache does not
 * short-circuit the stub.
 */

import { test } from '@japa/runner'
import { OllamaStub } from '../helpers/ollama_stub.js'
import { OllamaService } from '#services/ollama_service'

// Seeded IDs (will hit DB-cache and NOT call Ollama)
const SEEDED_ID = 'tt14144906' // Peacemaker — present in title_replacement_seeder

// ─── checkAvailableModels ─────────────────────────────────────────────────────

test.group('OllamaService.checkAvailableModels', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  test('returns model names when Ollama is reachable', async ({ assert }) => {
    const models = await OllamaService.checkAvailableModels()

    assert.isArray(models)
    assert.isNotEmpty(models!)
    assert.include(models!, 'llama3:latest')
  })

  test('returns null when Ollama is unavailable', async ({ assert }) => {
    OllamaStub.simulateUnavailable()

    const models = await OllamaService.checkAvailableModels()

    assert.isNull(models)
  })

  test('returns null when /api/tags returns empty models array', async ({ assert }) => {
    OllamaStub.setNextTagsResponse({ models: [] })

    const models = await OllamaService.checkAvailableModels()

    assert.isNull(models)
  })
})

// ─── getTitleInfo — DB-hit path (seeded data) ─────────────────────────────────

test.group('OllamaService.getTitleInfo (from DB cache)', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  test('returns cached title info from DB without calling Ollama', async ({ assert }) => {
    // This ID is seeded → only DB is hit; nock is active but no request expected.
    const info = await OllamaService.getTitleInfo(SEEDED_ID)

    assert.isNotNull(info)
    assert.equal(info!.imdbId, SEEDED_ID)
    assert.isString(info!.originalTitle)
    assert.isNotEmpty(info!.originalTitle)
    assert.isObject(info!.availableLanguages)
    assert.isDefined(info!.availableLanguages['en'])
    assert.isDefined(info!.lastUpdated)
  })

  test('second call returns same data (cache stays consistent)', async ({ assert }) => {
    const first = await OllamaService.getTitleInfo(SEEDED_ID)
    const second = await OllamaService.getTitleInfo(SEEDED_ID)

    assert.isNotNull(first)
    assert.isNotNull(second)
    assert.equal(first!.imdbId, second!.imdbId)
    assert.equal(first!.originalTitle, second!.originalTitle)
  })
})

// ─── getTitleInfo — LLM path (synthetic IDs not in seed) ─────────────────────

test.group('OllamaService.getTitleInfo (LLM path)', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  // Each test uses a unique ID so previous insertions don't cause cache hits
  let testCounter = 1000
  function freshId() {
    return `tt991${testCounter++}`
  }

  test('returns title info fetched from Ollama for an unknown ID', async ({ assert }) => {
    const info = await OllamaService.getTitleInfo(freshId())

    // Default stub responds with Peacemaker data
    assert.isNotNull(info)
    assert.isString(info!.originalTitle)
    assert.isNotEmpty(info!.originalTitle)
    assert.isObject(info!.availableLanguages)
    assert.isDefined(info!.availableLanguages['en'])
  })

  test('returns null when LLM responds with "null" (unknown IMDb ID)', async ({ assert }) => {
    OllamaStub.setNextChatResponse('null')

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNull(info)
  })

  test('returns null when LLM returns a generic placeholder title', async ({ assert }) => {
    OllamaStub.setNextChatResponse(
      OllamaStub.makeTitleInfoResponse({ originalTitle: 'The Original Title' })
    )

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNull(info)
  })

  test('returns null when LLM returns empty originalTitle', async ({ assert }) => {
    OllamaStub.setNextChatResponse({ originalTitle: '', availableLanguages: { en: '' } })

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNull(info)
  })

  test('returns null when Ollama is unreachable (LLM path)', async ({ assert }) => {
    OllamaStub.simulateUnavailable()

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNull(info)
  })

  test('always includes English in availableLanguages', async ({ assert }) => {
    OllamaStub.setNextChatResponse(
      OllamaStub.makeTitleInfoResponse({
        originalTitle: 'Peacemaker',
        languages: { 'pt-BR': 'Pacificador' },
      })
    )

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNotNull(info)
    assert.isDefined(info!.availableLanguages['en'])
  })

  test('strips whitespace from titles provided by LLM', async ({ assert }) => {
    OllamaStub.setNextChatResponse({
      originalTitle: '  Peacemaker  ',
      availableLanguages: {
        en: '  Peacemaker  ',
        'pt-BR': '  Pacificador  ',
      },
    })

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNotNull(info)
    assert.equal(info!.originalTitle, 'Peacemaker')
    assert.equal(info!.availableLanguages['pt-BR'], 'Pacificador')
  })

  test('returns null when response JSON is malformed', async ({ assert }) => {
    OllamaStub.setNextChatResponse('not valid json {{{')

    const info = await OllamaService.getTitleInfo(freshId())

    assert.isNull(info)
  })
})

// ─── analyzeSearchResults ─────────────────────────────────────────────────────

test.group('OllamaService.analyzeSearchResults', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  const sampleResults = [
    'Pacificador S02E07 Like a Keith in the Night',
    'Pacificador S02E06 Some Episode',
    'Peacemaker S02E05 Another Episode',
  ]

  test('returns analysis result with translations (seeded ID — DB cache used)', async ({
    assert,
  }) => {
    // When using a seeded ID, getTitleInfo returns from DB; the stub only needs
    // to handle the analysis /api/chat call.
    const result = await OllamaService.analyzeSearchResults(sampleResults, SEEDED_ID)

    assert.isNotNull(result)
    assert.isObject(result)

    const titles = Object.keys(result!)
    assert.isNotEmpty(titles, 'Expected at least one original title identified')

    const key = titles[0]
    assert.isString(key)
    assert.isObject(result![key].translations)
  })

  test('returns analysis result without imdbId', async ({ assert }) => {
    OllamaStub.setNextChatResponse(
      OllamaStub.makeAnalysisResponse({ originalTitle: 'Peacemaker' })
    )

    const result = await OllamaService.analyzeSearchResults(sampleResults)

    assert.isNotNull(result)
    assert.isDefined(result!['Peacemaker'])
  })

  test('returns null when Ollama is unavailable', async ({ assert }) => {
    OllamaStub.simulateUnavailable()

    const result = await OllamaService.analyzeSearchResults(sampleResults)

    assert.isNull(result)
  })

  test('returns null or object when LLM response is malformed (no crash)', async ({ assert }) => {
    OllamaStub.setNextChatResponse('not json')

    const result = await OllamaService.analyzeSearchResults(sampleResults)

    // May return null or fall through to fallback — either is acceptable
    assert.isTrue(result === null || typeof result === 'object')
  })

  test('handles empty search results gracefully (no exception)', async ({ assert }) => {
    const result = await OllamaService.analyzeSearchResults([])

    assert.isTrue(result === null || typeof result === 'object')
  })
})

// ─── getAvailableLanguages ────────────────────────────────────────────────────

test.group('OllamaService.getAvailableLanguages', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  test('returns language map for a seeded ID (from DB cache)', async ({ assert }) => {
    const langs = await OllamaService.getAvailableLanguages(SEEDED_ID)

    assert.isNotNull(langs)
    assert.isObject(langs)
    assert.isDefined(langs!['en'])
  })

  test('returns language map for an LLM-fetched ID', async ({ assert }) => {
    // Use a unique synthetic ID so the DB has no cached entry
    const langs = await OllamaService.getAvailableLanguages('tt99300001')

    // Default stub returns Peacemaker with en + pt-BR
    assert.isNotNull(langs)
    assert.isObject(langs)
    assert.isDefined(langs!['en'])
  })

  test('returns null when LLM returns null (getTitleInfo fails)', async ({ assert }) => {
    OllamaStub.setNextChatResponse('null')

    const langs = await OllamaService.getAvailableLanguages('tt99300002')

    assert.isNull(langs)
  })
})

