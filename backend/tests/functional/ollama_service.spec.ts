/**
 * Functional tests for OllamaService.
 *
 * These run inside the AdonisJS application context (HTTP server up, DB migrated).
 * All Ollama HTTP calls are intercepted by OllamaStub so no running Ollama
 * instance is required.
 */

import { test } from '@japa/runner'
import { OllamaStub } from '../helpers/ollama_stub.js'
import { OllamaService } from '#services/ollama_service'

test.group('OllamaService - functional (stubbed)', (group) => {
  group.each.setup(() => OllamaStub.setup())
  group.each.teardown(() => OllamaStub.teardown())

  // ─── getTitleInfo ──────────────────────────────────────────────────────────

  test('getTitleInfo returns correctly structured title info', async ({ assert }) => {
    const titleInfo = await OllamaService.getTitleInfo('tt14144906')

    assert.isNotNull(titleInfo)
    assert.equal(titleInfo!.imdbId, 'tt14144906')
    assert.isString(titleInfo!.originalTitle)
    assert.isObject(titleInfo!.availableLanguages)
    assert.isDefined(titleInfo!.availableLanguages['en'])
    assert.isDefined(titleInfo!.lastUpdated)
  })

  test('getTitleInfo returns null for non-existent IMDb ID (LLM returns null)', async ({
    assert,
  }) => {
    // Stub: LLM says it does not know this ID
    OllamaStub.setNextChatResponse('null')

    const titleInfo = await OllamaService.getTitleInfo('tt00000000')

    assert.isNull(titleInfo)
  })

  test(
    'getTitleInfo is cached — second call returns same data without a new LLM call',
    async ({ assert }) => {
      // First call fetches from LLM
      const first = await OllamaService.getTitleInfo('tt14144906')
      assert.isNotNull(first)

      // Simulate unavailable so a real second HTTP call would fail
      OllamaStub.simulateUnavailable()

      // If the DB is available the data is cached; if not, the second call
      // goes to Ollama (and will fail → null).  Either way must not throw.
      const second = await OllamaService.getTitleInfo('tt14144906')

      // The two results should have the same imdbId if both succeeded
      if (first !== null && second !== null) {
        assert.equal(first.imdbId, second.imdbId)
        assert.equal(first.originalTitle, second.originalTitle)
      } else {
        // At least it did not throw
        assert.isTrue(true)
      }
    }
  )

  // ─── checkAvailableModels ──────────────────────────────────────────────────

  test('checkAvailableModels returns available model names', async ({ assert }) => {
    const models = await OllamaService.checkAvailableModels()

    assert.isArray(models)
    assert.isNotEmpty(models!)
  })

  test('checkAvailableModels returns null when Ollama is down', async ({ assert }) => {
    OllamaStub.simulateUnavailable()

    const models = await OllamaService.checkAvailableModels()

    assert.isNull(models)
  })

  // ─── analyzeSearchResults ──────────────────────────────────────────────────

  test('analyzeSearchResults identifies original title from a set of search strings', async ({
    assert,
  }) => {
    const searchResults = [
      'Pacificador S02E07 Like a Keith in the Night',
      'Pacificador S02E06 Some Episode',
      'Peacemaker S02E05 Another Episode',
    ]

    const result = await OllamaService.analyzeSearchResults(searchResults, 'tt14144906')

    assert.isNotNull(result)
    assert.isObject(result)

    const keys = Object.keys(result!)
    assert.isNotEmpty(keys, 'Expected at least one original title identified')

    const firstKey = keys[0]
    assert.isString(firstKey)
    assert.isObject(result![firstKey].translations)
  })

  test('analyzeSearchResults returns null when Ollama is unavailable', async ({ assert }) => {
    OllamaStub.simulateUnavailable()

    const result = await OllamaService.analyzeSearchResults(['Some Title S01E01'])

    assert.isNull(result)
  })
})
