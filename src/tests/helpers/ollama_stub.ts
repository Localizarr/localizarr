/**
 * OllamaStub — test helper that injects in-process mock adapters into OllamaService.
 *
 * Works by calling `OllamaService.setTestAdapters()` to replace the real Ollama
 * SDK client and native fetch with deterministic in-memory stubs.
 *
 * Usage:
 *   import { OllamaStub } from '#tests/helpers/ollama_stub'
 *
 *   group.each.setup(()    => OllamaStub.setup())
 *   group.each.teardown(() => OllamaStub.teardown())
 *
 *   // Optionally override the default response for the next chat call:
 *   OllamaStub.setNextChatResponse({ originalTitle: 'My Show', ... })
 */

import { OllamaService, OllamaTestAdapter } from '#services/ollama_service'

// ─── Default fixture payloads ──────────────────────────────────────────────────

const DEFAULT_TAGS_BODY = {
  models: [{ name: 'llama3:latest' }],
}

const DEFAULT_CHAT_JSON = {
  originalTitle: 'Peacemaker',
  availableLanguages: {
    en: 'Peacemaker',
    'pt-BR': 'Pacificador',
    es: 'El Pacificador',
  },
}

const DEFAULT_ANALYSIS_JSON = {
  originalTitle: 'Peacemaker',
  imdbId: 'tt14144906',
  translations: {
    'pt-BR': 'Pacificador',
    es: 'El Pacificador',
  },
}

const DEFAULT_VALIDATION_TEXT = 'ORIGINAL'

// ─── State ────────────────────────────────────────────────────────────────────

let _nextChatResponse: object | string | null = null
let _nextTagsBody: object | null = null
let _unavailable = false

// ─── Stub adapters ────────────────────────────────────────────────────────────

/**
 * Builds the Ollama `chat` response envelope expected by OllamaService.
 */
function chatEnvelope(content: string): { message: { content: string } } {
  return { message: { content } }
}

/**
 * OllamaTestAdapter implementation.
 * Routes requests based on the prompt content, mirroring what a real LLM would return.
 */
const ollamaAdapter: OllamaTestAdapter = {
  async chat(request) {
    if (_unavailable) {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:11434')
        ; (err as any).code = 'ECONNREFUSED'
      throw err
    }

    const prompt: string = request.messages?.[0]?.content ?? ''

    // Validation prompt: "ORIGINAL or TRANSLATION?"
    if (prompt.includes('ANALYZE THIS TITLE') || (prompt.includes('ORIGINAL') && prompt.includes('TRANSLATION') && !prompt.includes('"translations"'))) {
      return chatEnvelope(DEFAULT_VALIDATION_TEXT)
    }

    // If caller set a per-test override, use it once
    if (_nextChatResponse !== null) {
      const resp = _nextChatResponse
      _nextChatResponse = null
      return chatEnvelope(typeof resp === 'string' ? resp : JSON.stringify(resp))
    }

    // Analysis prompt: analyzeSearchResults
    if (prompt.includes('"translations"') || prompt.includes('ANALYZE THESE SEARCH TITLES')) {
      return chatEnvelope(JSON.stringify(DEFAULT_ANALYSIS_JSON))
    }

    // Default: getTitleInfo / fetchTitleInfoFromOllama
    return chatEnvelope(JSON.stringify(DEFAULT_CHAT_JSON))
  },
}

/**
 * Builds a fetch mock that responds to /api/tags.
 */
function makeFetchAdapter(tagsBody: object, unavailable: boolean): typeof fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    if (unavailable) {
      throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    }

    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/api/tags')) {
      return new Response(JSON.stringify(tagsBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Unexpected URL — simulate 404
    return new Response('Not Found', { status: 404 })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const OllamaStub = {
  /**
   * Activate the stub adapters.
   * Call this in group.each.setup() (or group.setup() for the whole group).
   */
  setup(): void {
    _unavailable = false
    _nextChatResponse = null
    _nextTagsBody = null
    OllamaService.setTestAdapters({
      ollama: ollamaAdapter,
      fetch: makeFetchAdapter(_nextTagsBody ?? DEFAULT_TAGS_BODY, false),
    })
  },

  /**
   * Restore the real adapters.
   * Call this in group.each.teardown().
   */
  teardown(): void {
    OllamaService.resetTestAdapters()
    _unavailable = false
    _nextChatResponse = null
    _nextTagsBody = null
  },

  /**
   * Override the response returned for the NEXT chat() call, then revert to default.
   * Pass a plain object to simulate a JSON response or a string for text responses.
   */
  setNextChatResponse(response: object | string): void {
    _nextChatResponse = response
  },

  /**
   * Override the /api/tags body for the remainder of this test.
   * (Re-registers the fetch adapter immediately.)
   */
  setNextTagsResponse(body: object): void {
    _nextTagsBody = body
    OllamaService.setTestAdapters({
      ollama: ollamaAdapter,
      fetch: makeFetchAdapter(body, false),
    })
  },

  /**
   * Simulate Ollama being completely unavailable (all calls throw ECONNREFUSED).
   */
  simulateUnavailable(): void {
    _unavailable = true
    OllamaService.setTestAdapters({
      ollama: {
        async chat(_req) {
          const err = new Error('connect ECONNREFUSED 127.0.0.1:11434')
            ; (err as any).code = 'ECONNREFUSED'
          throw err
        },
      },
      fetch: makeFetchAdapter({}, true),
    })
  },

  // ─── Fixture builder helpers ──────────────────────────────────────────────

  /**
   * Build a `getTitleInfo`-style fixture for a given show.
   */
  makeTitleInfoResponse(opts: {
    originalTitle: string
    languages?: Record<string, string>
  }): object {
    return {
      originalTitle: opts.originalTitle,
      availableLanguages: {
        en: opts.originalTitle,
        ...opts.languages,
      },
    }
  },

  /**
   * Build an `analyzeSearchResults`-style fixture.
   */
  makeAnalysisResponse(opts: {
    originalTitle: string
    imdbId?: string
    translations?: Record<string, string>
  }): object {
    return {
      originalTitle: opts.originalTitle,
      imdbId: opts.imdbId ?? '',
      translations: opts.translations ?? {},
    }
  },
}
