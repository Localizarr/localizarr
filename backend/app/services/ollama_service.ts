import { Ollama } from 'ollama'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'
import { ollama as ollamaConfig } from '#config/app'
import { DateTime } from 'luxon'
import { SettingsService } from '#services/settings_service'

export interface ImdbMetadata {
  primaryTitle: string
  titleType: string
  startYear: string | null
  endYear: string | null
  runtimeMinutes: string | null
  genres: string | null
}

export interface OllamaTitleInfo {
  imdbId: string
  originalTitle: string
  availableLanguages: { [langCode: string]: string }
  lastUpdated: DateTime
  imdbMetadata?: ImdbMetadata
}

/**
 * Minimal interface that tests can implement to stub Ollama chat calls.
 * Matches the subset of `Ollama` used by `OllamaService`.
 */
export interface OllamaTestAdapter {
  chat(request: {
    model: string
    messages: Array<{ role: string; content: string }>
    format?: string
  }): Promise<{ message: { content: string } }>
}

export class OllamaService {
  private static readonly CACHE_EXPIRY_HOURS = 24 // 24 hours cache expiry
  // Lazy client rebuilt when URL changes via Settings — supports UI switch without restart
  private static _ollama: Ollama | null = null
  private static _ollamaUrl: string | null = null
  private static readonly LLM_TIMEOUT_MS = 12000 // ponytail: abort Ollama before Prowlarr 35s timeout (30s + margin)

  private static async getOllama(): Promise<Ollama> {
    if (this._testOllamaAdapter) return this._testOllamaAdapter as any
    const url = await SettingsService.getOllamaUrl()
    if (!this._ollama || this._ollamaUrl !== url) {
      this._ollama = new Ollama({ host: url })
      this._ollamaUrl = url
    }
    return this._ollama
  }

  private static async getModel(): Promise<string> {
    return SettingsService.getOllamaModel()
  }

  private static async chatWithTimeout(req: { model: string; messages: any[]; format?: string }): Promise<any> {
    const ollama = await this.getOllama()
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), this.LLM_TIMEOUT_MS)
    try {
      // ollama SDK doesn't expose signal; race with timeout
      const p = (ollama as any).chat(req)
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('LLM timeout 12s')), this.LLM_TIMEOUT_MS))
      return await Promise.race([p, timeout])
    } finally { clearTimeout(t); try { controller.abort() } catch {} }
  }

  // ─── Test-only dependency injection ────────────────────────────────────────
  // These fields are `undefined` in production and only set during tests via
  // `OllamaService.setTestAdapters(...)`.  All internal methods go through the
  // private getters below so the real SDK is used by default.
  private static _testOllamaAdapter: OllamaTestAdapter | null = null
  private static _testFetch: typeof fetch | null = null

  /**
   * Inject mock adapters for automated tests.
   * Call `resetTestAdapters()` during teardown to restore production behaviour.
   *
   * Only works when called from test code — in production this is a safe no-op.
   */
  static setTestAdapters(adapters: {
    ollama?: OllamaTestAdapter
    fetch?: typeof fetch
  }): void {
    this._testOllamaAdapter = adapters.ollama ?? null
    this._testFetch = adapters.fetch ?? null
  }

  /** Remove previously injected test adapters, reverting to production behaviour. */
  static resetTestAdapters(): void {
    this._testOllamaAdapter = null
    this._testFetch = null
  }

  // @ts-ignore - kept for test injection via setTestAdapters
  private static get ollamaAdapter(): Pick<Ollama, 'chat'> {
    return (this._testOllamaAdapter as any) ?? (this._ollama as any) ?? new Ollama({ host: ollamaConfig.url })
  }

  /** Returns the real or stubbed `fetch`. */
  private static get fetchAdapter(): typeof fetch {
    return (this._testFetch as any) ?? fetch
  }

  /**
   * Check connection to Ollama and return available models.
   * If `OLLAMA_MODEL` not specified, this will pick the first model and set it in runtime config.
   */
  static async checkAvailableModels(customUrl?: string): Promise<string[] | null> {
    try {
      const baseUrl = customUrl ?? (await SettingsService.getOllamaUrl())
      console.log('[OllamaService] Checking available models on Ollama at', baseUrl)

      const modelsUrl = new URL('/api/tags', baseUrl).toString()
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 5000)
      let res: Response
      try {
        res = await this.fetchAdapter(modelsUrl, { method: 'GET', signal: controller.signal } as any)
      } finally { clearTimeout(t) }

      if (!res.ok) {
        console.error(
          '[OllamaService] Failed to list models from Ollama:',
          res.status,
          res.statusText
        )
        return null
      }

      const data = (await res.json()) as any
      if (!data.models || !Array.isArray(data.models) || data.models.length === 0) {
        console.error('[OllamaService] No models returned from Ollama')
        return null
      }

      const modelNames = data.models.map((m: any) => (m.name ? m.name : m))
      console.log('[OllamaService] Available Ollama models:', modelNames)

      // If no model configured (env or settings), persist first model to settings
      const currentModel = await SettingsService.getOllamaModel()
      if (!currentModel || currentModel.trim() === '') {
        const firstModel = modelNames[0]
        console.log('[OllamaService] No OLLAMA_MODEL configured. Using first available model:', firstModel)
        try { await SettingsService.set('ollama_model', firstModel) } catch {}
        ;(ollamaConfig as any).model = firstModel
      }

      return modelNames
    } catch (error: any) {
      console.error(
        '[OllamaService] Error connecting to Ollama to list models:',
        error?.message ?? error
      )
      return null
    }
  }

  /**
   * Format IMDb metadata into a readable string for LLM context
   */
  private static formatImdbContextForLLM(metadata?: ImdbMetadata): string {
    if (!metadata) return ''

    const parts = [
      `TITLE INFO FROM IMDB:`,
      `- Primary Title: "${metadata.primaryTitle}"`,
      `- Type: ${metadata.titleType}`,
    ]

    if (metadata.startYear)
      parts.push(`- Year: ${metadata.startYear}${metadata.endYear ? '-' + metadata.endYear : ''}`)
    if (metadata.genres) parts.push(`- Genres: ${metadata.genres}`)
    if (metadata.runtimeMinutes && metadata.runtimeMinutes !== '\\N')
      parts.push(`- Runtime: ${metadata.runtimeMinutes} min`)

    return parts.join('\n')
  }

  /**
   * Use LLM to validate if a cached title is the original English title or a translation
   */
  private static async validateCachedTitleWithLLM(
    cachedTitle: string,
    imdbId: string
  ): Promise<boolean> {
    try {
      console.log(
        `[OllamaService] Validating cached title "${cachedTitle}" for IMDb ${imdbId} with LLM`
      )

      const prompt = `ANALYZE THIS TITLE: Is this the ORIGINAL ENGLISH title or a TRANSLATION?

TITLE TO ANALYZE: "${cachedTitle}"
IMDb ID: ${imdbId}

INSTRUCTIONS:
- Determine if this title appears to be in English or translated to another language
- Look for linguistic patterns, cultural context, and naming conventions
- Consider if this looks like an official English title or a localized version

Return ONLY: "ORIGINAL" or "TRANSLATION"`

      const model = await this.getModel()
      const response = await this.chatWithTimeout({
        model,
        messages: [{ role: 'user', content: prompt }],
      })

      const result = response.message.content.trim().toUpperCase()
      const isTranslation = result.includes('TRANSLATION')

      console.log(
        `[OllamaService] LLM validation result: "${cachedTitle}" is ${isTranslation ? 'TRANSLATION' : 'ORIGINAL'}`
      )

      return isTranslation
    } catch (error) {
      console.error(`[OllamaService] Error validating cached title with LLM:`, error)
      // On error, assume it's valid to avoid breaking the system
      return false
    }
  }

  /**
   * Check if cached title data looks suspicious (original title appears to be a translation)
   */
  private static async isCachedDataSuspicious(titleInfo: OllamaTitleInfo): Promise<boolean> {
    // Use LLM to validate if the cached title is actually a translation
    return await this.validateCachedTitleWithLLM(titleInfo.originalTitle, titleInfo.imdbId)
  }

  /**
   * Get title information from TheTVDB, using cache if available and not expired
   */
  static async getTitleInfo(imdbId: string, executionLog?: any): Promise<OllamaTitleInfo | null> {
    console.log(`[OllamaService] Getting title info for IMDb ID: ${imdbId}`)

    try {
      // Check if we have recent data in database
      const existingTitle = await Title.query()
        .where('imdb_id', imdbId)
        .preload('localizedNames')
        .first()

      if (existingTitle) {
        const hoursSinceUpdate = DateTime.now().diff(existingTitle.updatedAt, 'hours').hours

        if (hoursSinceUpdate < this.CACHE_EXPIRY_HOURS) {
          // Build cached data
          const availableLanguages: { [langCode: string]: string } = {}
          for (const localizedName of existingTitle.localizedNames) {
            availableLanguages[localizedName.langId] = localizedName.localizedName
          }

          // Ensure English is always included
          if (!availableLanguages['en']) {
            availableLanguages['en'] = existingTitle.originalTitle
          }

          // Parse IMDb metadata if available
          let imdbMetadata: ImdbMetadata | undefined
          if (existingTitle.imdbData) {
            try {
              // Handle if it's already an object or a string
              const rawData =
                typeof existingTitle.imdbData === 'string'
                  ? JSON.parse(existingTitle.imdbData)
                  : existingTitle.imdbData

              imdbMetadata = {
                primaryTitle: rawData.primaryTitle,
                titleType: rawData.titleType || rawData.mediaType,
                startYear: rawData.startYear,
                endYear: rawData.endYear,
                runtimeMinutes: rawData.runtimeMinutes,
                genres: rawData.genres,
              }
            } catch (e) {
              console.warn(`[OllamaService] Failed to parse IMDb data for ${imdbId}:`, e.message)
            }
          }

          const cachedTitleInfo: OllamaTitleInfo = {
            imdbId: existingTitle.imdbId,
            originalTitle: existingTitle.originalTitle,
            availableLanguages,
            lastUpdated: existingTitle.updatedAt,
            imdbMetadata,
          }

          // Check if cached data looks suspicious (original title appears to be a translation)
          // Only validate titles that were inferred from search results, not direct IMDb queries
          const isFromDirectImdbQuery = existingTitle.imdbId && existingTitle.originalTitle
          if (!isFromDirectImdbQuery && (await this.isCachedDataSuspicious(cachedTitleInfo))) {
            console.log(
              `[OllamaService] Cached data for ${imdbId} appears suspicious (original title "${existingTitle.originalTitle}" looks like a translation). Forcing refresh.`
            )
            // Force refresh by falling through to fetch fresh data
          } else {
            console.log(
              `[OllamaService] Using cached data for ${imdbId} (${hoursSinceUpdate.toFixed(1)}h old)`
            )
            return cachedTitleInfo
          }
        } else {
          console.log(
            `[OllamaService] Cache expired for ${imdbId} (${hoursSinceUpdate.toFixed(1)}h old), fetching fresh data`
          )
        }
      }

      // Fetch fresh data from Ollama
      return await this.fetchTitleInfoFromOllama(imdbId, executionLog)
    } catch (error) {
      console.log(
        `[OllamaService] Database not available (this is normal in test environments): ${error.message}`
      )
      // Fall back to fetching fresh data without cache
      return await this.fetchTitleInfoFromOllama(imdbId, executionLog)
    }
  }

  /**
   * Fetch title information using Ollama AI model
   */
  private static async fetchTitleInfoFromOllama(
    imdbId: string,
    executionLog?: any
  ): Promise<OllamaTitleInfo | null> {
    try {
      console.log(`[OllamaService] Fetching title info from Ollama for ${imdbId}`)

      const prompt = `What is the original English title for IMDb ID ${imdbId}?

CRITICAL: If you do NOT know this exact IMDb ID or cannot provide accurate information, return ONLY: null

Return ONLY valid JSON in this exact format, or null if unknown:

{
  "originalTitle": "The Exact Original English Title",
  "availableLanguages": {
    "en": "The Exact Original English Title",
    "es": "Spanish Title",
    "fr": "French Title",
    "pt-BR": "Portuguese Brazilian Title",
    "pt-PT": "Portuguese European Title",
    "de": "German Title"
  }
}

Do NOT guess or make up titles. Return null for unknown IDs.`

      if (executionLog) {
        try {
          // Note: This might overwrite the analyzeSearchResults prompt if they happen in sequence,
          // but usually analyzeSearchResults calls getTitleInfo FIRST.
          executionLog.llmPrompt =
            (executionLog.llmPrompt || '') + '\n\n[GET_TITLE_INFO_PROMPT]\n' + prompt
          await executionLog.save()
        } catch (e) { }
      }

      const model = await this.getModel()
      const response = await this.chatWithTimeout({
        model,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
      })

      console.log(`[OllamaService] Ollama response received for ${imdbId}`)

      // Parse the JSON response
      const content = response.message.content.trim()

      if (executionLog) {
        try {
          executionLog.llmResponse =
            (executionLog.llmResponse || '') + '\n\n[GET_TITLE_INFO_RESPONSE]\n' + content
          await executionLog.save()
        } catch (e) { }
      }

      let parsedData

      try {
        parsedData = JSON.parse(content)
      } catch (parseError) {
        console.error(`[OllamaService] Failed to parse Ollama response as JSON:`, content)
        return null
      }

      // Validate the response structure
      if (!parsedData || !parsedData.originalTitle || !parsedData.availableLanguages) {
        console.log(`[OllamaService] Invalid response structure from Ollama for ${imdbId}`)
        console.log(`[OllamaService] Raw response:`, content)
        return null
      }

      // Check for generic/placeholder responses that indicate the LLM doesn't know the title
      const originalTitle = parsedData.originalTitle.trim()
      if (
        originalTitle === '' ||
        originalTitle.toLowerCase() === 'unknown' ||
        originalTitle.toLowerCase() === 'the original title' ||
        originalTitle.toLowerCase().includes('original title') ||
        originalTitle.length < 2
      ) {
        console.log(
          `[OllamaService] LLM returned generic/placeholder title "${originalTitle}" for ${imdbId}, treating as unknown`
        )
        return null
      }

      // Check if availableLanguages has meaningful content
      const langKeys = Object.keys(parsedData.availableLanguages)
      if (langKeys.length === 0) {
        console.log(`[OllamaService] No language information available for ${imdbId}`)
        return null
      }

      // Check if all language entries are generic
      const hasRealTranslations = langKeys.some((langCode) => {
        const title = parsedData.availableLanguages[langCode]?.trim()
        return (
          title &&
          title !== originalTitle &&
          !title.toLowerCase().includes('title') &&
          title.length > 1
        )
      })

      if (!hasRealTranslations) {
        console.log(
          `[OllamaService] Only generic language entries found for ${imdbId}, treating as unknown`
        )
        return null
      }

      // Filter out invalid language entries and ensure English is included
      const availableLanguages: { [langCode: string]: string } = {}
      for (const [langCode, title] of Object.entries(parsedData.availableLanguages)) {
        if (typeof title === 'string' && title.trim().length > 0) {
          availableLanguages[langCode] = title.trim()
        }
      }

      // Ensure English is always included
      if (!availableLanguages['en']) {
        availableLanguages['en'] = parsedData.originalTitle.trim()
      }

      console.log(
        `[OllamaService] Found ${Object.keys(availableLanguages).length} languages for ${imdbId}`
      )

      // Create title info
      const now = DateTime.now()
      const titleInfo: OllamaTitleInfo = {
        imdbId,
        originalTitle: parsedData.originalTitle.trim(),
        availableLanguages,
        lastUpdated: now,
      }

      await this.saveTitleInfoToDatabase(titleInfo)

      return titleInfo
    } catch (error) {
      console.error(`[OllamaService] Error fetching data from Ollama for ${imdbId}:`, error)

      // Check if it's a connection error to Ollama
      if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.message?.includes('LLM timeout')) {
        const url = await SettingsService.getOllamaUrl().catch(() => ollamaConfig.url)
        const model = await SettingsService.getOllamaModel().catch(() => ollamaConfig.model)
        console.error(`[OllamaService] Cannot connect to Ollama server at ${url}`)
        console.error('[OllamaService] Make sure Ollama is running: ollama serve')
        console.error(`[OllamaService] Make sure the model '${model}' is available: ollama pull ${model}`)
      }

      return null
    }
  }

  /**
   * Save title information to database
   */
  private static async saveTitleInfoToDatabase(titleInfo: OllamaTitleInfo): Promise<void> {
    try {
      console.log(`[OllamaService] Saving title info to database for ${titleInfo.imdbId}`)

      // Find or create the title
      let title = await Title.query().where('imdb_id', titleInfo.imdbId).first()

      if (!title) {
        title = await Title.create({
          imdbId: titleInfo.imdbId,
          mediaType: 'tv', // Default to TV, can be updated later
          originalTitle: titleInfo.originalTitle,
        })
        console.log(`[OllamaService] Created new title: ${titleInfo.imdbId}`)
      } else {
        // Update original title only if it's empty or null
        if (!title.originalTitle || title.originalTitle.trim() === '') {
          title.originalTitle = titleInfo.originalTitle
          await title.save()
          console.log(`[OllamaService] Updated empty title: ${titleInfo.imdbId}`)
        } else {
          console.log(
            `[OllamaService] Title already has value, skipping update: ${titleInfo.imdbId}`
          )
        }
      }

      // Update localized names
      for (const [langId, localizedName] of Object.entries(titleInfo.availableLanguages)) {
        const existingLocalized = await LocalizedName.query()
          .where('titleId', title.id)
          .where('langId', langId)
          .first()

        if (existingLocalized) {
          await existingLocalized.merge({ localizedName }).save()
          console.log(`[OllamaService] Updated localized name for ${langId}: ${localizedName}`)
        } else {
          await LocalizedName.create({
            titleId: title.id,
            langId,
            localizedName,
          })
          console.log(`[OllamaService] Created localized name for ${langId}: ${localizedName}`)
        }
      }

      console.log(`[OllamaService] Successfully saved title info for ${titleInfo.imdbId}`)
    } catch (error) {
      console.error(`[OllamaService] Error saving to database for ${titleInfo.imdbId}:`, error)
      throw error
    }
  }

  /**
   * Save inferred title information from LLM analysis to database
   */
  private static async saveInferredTitleToDatabase(
    imdbId: string,
    originalTitle: string,
    translations: { [langCode: string]: string }
  ): Promise<void> {
    try {
      console.log(`[OllamaService] Saving inferred title "${originalTitle}" for IMDb ID ${imdbId}`)

      // Find or create the title
      let title = await Title.query().where('imdb_id', imdbId).first()

      if (!title) {
        title = await Title.create({
          imdbId,
          mediaType: 'tv', // Default to TV, can be updated later
          originalTitle,
        })
        console.log(
          `[OllamaService] Created new title from inference: ${imdbId} -> "${originalTitle}"`
        )
      } else {
        // Update original title only if it's empty or null
        if (!title.originalTitle || title.originalTitle.trim() === '') {
          title.originalTitle = originalTitle
          await title.save()
          console.log(
            `[OllamaService] Updated empty title from inference: ${imdbId} -> "${originalTitle}"`
          )
        } else {
          console.log(
            `[OllamaService] Title already has value, skipping update for inferred title: ${imdbId} -> "${originalTitle}"`
          )
        }
      }

      // Save translations as localized names
      for (const [langCode, localizedTitle] of Object.entries(translations)) {
        if (localizedTitle && localizedTitle.trim().length > 0) {
          const existingLocalized = await LocalizedName.query()
            .where('titleId', title.id)
            .where('langId', langCode)
            .first()

          if (existingLocalized) {
            if (existingLocalized.localizedName !== localizedTitle) {
              await existingLocalized.merge({ localizedName: localizedTitle }).save()
              console.log(
                `[OllamaService] Updated translation for ${langCode}: "${localizedTitle}"`
              )
            }
          } else {
            await LocalizedName.create({
              titleId: title.id,
              langId: langCode,
              localizedName: localizedTitle,
            })
            console.log(`[OllamaService] Created translation for ${langCode}: "${localizedTitle}"`)
          }
        }
      }

      console.log(`[OllamaService] Successfully saved inferred title data for ${imdbId}`)
    } catch (error) {
      console.error(`[OllamaService] Error saving inferred title to database for ${imdbId}:`, error)
      throw error
    }
  }

  /**
   * Get all available languages for a title (cached)
   */
  static async getAvailableLanguages(
    imdbId: string
  ): Promise<{ [langCode: string]: string } | null> {
    const titleInfo = await this.getTitleInfo(imdbId)
    return titleInfo ? titleInfo.availableLanguages : null
  }

  /**
   * Analyze search results and identify original titles vs translations
   * Returns mapping of original titles to their translations
   */
  static async analyzeSearchResults(
    searchResults: string[],
    imdbId?: string,
    executionLog?: any
  ): Promise<{
    [originalTitle: string]: {
      imdbId?: string
      translations: { [langCode: string]: string }
    }
  } | null> {
    try {
      console.log(
        `[OllamaService] Analyzing ${searchResults.length} search results${imdbId ? ` for IMDb ID: ${imdbId}` : ''}`
      )

      // If we have an IMDb ID, try to get the real title information first
      let realTitleInfo = null
      let useCachedTitle = true

      if (imdbId) {
        console.log(`[OllamaService] Fetching real title info for IMDb ID: ${imdbId}`)
        realTitleInfo = await this.getTitleInfo(imdbId, executionLog)

        if (realTitleInfo) {
          console.log(`[OllamaService] Real title info obtained:`, {
            imdbId: realTitleInfo.imdbId,
            originalTitle: realTitleInfo.originalTitle,
            availableLanguages: realTitleInfo.availableLanguages,
            lastUpdated: realTitleInfo.lastUpdated?.toISO(),
            imdbMetadata: realTitleInfo.imdbMetadata,
          })
          // Check if the cached title looks suspicious (only for inferred titles, not direct IMDb queries)
          const isFromDirectImdbQuery =
            realTitleInfo.imdbId &&
            realTitleInfo.availableLanguages['en'] === realTitleInfo.originalTitle
          if (!isFromDirectImdbQuery && (await this.isCachedDataSuspicious(realTitleInfo))) {
            console.log(
              `[OllamaService] Cached title "${realTitleInfo.originalTitle}" appears to be a translation. Will try to infer correct English title from search results.`
            )
            useCachedTitle = false
          } else {
            console.log(
              `[OllamaService] Found real title: "${realTitleInfo.originalTitle}" with ${Object.keys(realTitleInfo.availableLanguages).length} translations`
            )
          }
        } else {
          console.log(`[OllamaService] Could not fetch real title info for IMDb ID: ${imdbId}`)
        }
      }

      // Limit search results to 2000 characters to avoid overly long prompts
      const limitedSearchResults = searchResults
        .map((title, index) => `${index + 1}. "${title}"`)
        .join('\n')
        .substring(0, 2000)

      if (
        limitedSearchResults.length <
        searchResults.map((title, index) => `${index + 1}. "${title}"`).join('\n').length
      ) {
        console.log(
          `[OllamaService] Limited search results to 2000 characters (${searchResults.length} -> ${limitedSearchResults.split('\n').length} results)`
        )
      }

      // Create dynamic examples based on the actual results found
      const createDynamicExamples = (results: string[]) => {
        const examples = []
        const commonTitles = results
          .map((r) => r.split('.')[0].split('S')[0].split('E')[0].trim())
          .filter((title, index, arr) => arr.indexOf(title) === index && title.length > 2)
          .slice(0, 3) // Take up to 3 different titles as examples

        for (const title of commonTitles) {
          if (title.match(/[àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/i)) {
            // If title has accented characters, assume it's translated
            const englishVersion = title.replace(/[àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/gi, '').trim()
            if (englishVersion !== title) {
              examples.push(`- If results show "${title}": Original is "${englishVersion}"`)
            }
          }
        }

        return examples.length > 0 ? examples.join('\n') : ''
      }

      const dynamicExamples = createDynamicExamples(searchResults)

      // Format IMDb context if available
      const imdbContext = realTitleInfo?.imdbMetadata
        ? this.formatImdbContextForLLM(realTitleInfo.imdbMetadata)
        : ''

      console.log(`[OllamaService] IMDb context for prompt:`, {
        hasImdbMetadata: !!realTitleInfo?.imdbMetadata,
        imdbContextLength: imdbContext.length,
        imdbContext: imdbContext || 'No IMDb metadata available',
      })

      const prompt = `ANALYZE THESE SEARCH TITLES: Identify the ORIGINAL ENGLISH title and its TRANSLATIONS.
${imdbContext ? '\n' + imdbContext + '\n' : ''}
${imdbId ? `IMDb ID: ${imdbId}` : ''}
${realTitleInfo && useCachedTitle ? `REAL OFFICIAL TITLE: "${realTitleInfo.originalTitle}"` : realTitleInfo && !useCachedTitle ? `WARNING: Cached title "${realTitleInfo.originalTitle}" appears to be incorrect. Find the correct English title from the search results.` : ''}

SEARCH RESULTS TO ANALYZE:
${limitedSearchResults}

${dynamicExamples ? `DYNAMIC EXAMPLES BASED ON RESULTS:\n${dynamicExamples}\n` : ''}GENERAL EXAMPLES:
- If results show "Sueño de Fuga", "Les Évadés", "Sueño de fuga": Original is "The Shawshank Redemption"
- If results show "O Poderoso Chefão", "Der Pate", "El Padrino": Original is "The Godfather"
- If results show "Guerra nas Estrelas", "La Guerra de las Galaxias": Original is "Star Wars"
- If results show "Pacificador", "El Pacificador", "Le Pacificateur": Original is "Peacemaker"
- If results show "Coisas Estranhas", "Stranger Things": Original is "Stranger Things"

CRITICAL INSTRUCTIONS:
1. Find the MAIN title that appears in most results (this is usually the localized/translated title)
2. The ORIGINAL ENGLISH title is what this localized title gets translated TO (not from)
3. If you have valid IMDb info above, USE IT as the authoritative source
4. Map the localized title to its correct English original
5. Look for patterns: accented characters often indicate translations
6. ${!useCachedTitle ? 'IMPORTANT: Ignore any cached/incorrect titles mentioned above. Find the correct English title from these search results.' : ''}

Return ONLY this JSON format:
{
  "originalTitle": "${realTitleInfo && useCachedTitle ? realTitleInfo.originalTitle : '<Original English Title>'}",
  "imdbId": "${imdbId || '<ttXXXXXXX>'}",
  "translations": {
    "pt-BR": "<Portuguese Title>",
    "es": "<Spanish Title>"
  }
}

IMPORTANT:
- "originalTitle" = The English title that appears in IMDb
- "translations" = How that English title appears in other languages
- Only include translations you are certain about
- If results are already in English, translations can be empty {}
- Focus on the most common title pattern in the results`

      if (executionLog) {
        try {
          console.log(`[OllamaService] Logging prompt to execution log ${executionLog.id}`)
          executionLog.llmPrompt = prompt
          await executionLog.save()
          console.log(`[OllamaService] Prompt saved to execution log ${executionLog.id}`)
        } catch (e) {
          console.error('[OllamaService] Failed to log LLM prompt', e)
        }
      } else {
        console.log('[OllamaService] No execution log provided for prompt logging')
      }

      const model = await this.getModel()
      const response = await this.chatWithTimeout({
        model,
        messages: [{ role: 'user', content: prompt }],
        format: 'json',
      })

      console.log(`[OllamaService] Analysis response received`)

      // Parse the JSON response
      const content = response.message.content.trim()

      if (executionLog) {
        try {
          executionLog.llmResponse = content
          await executionLog.save()
        } catch (e) {
          console.error('[OllamaService] Failed to log LLM response', e)
        }
      }
      let parsedData

      try {
        parsedData = JSON.parse(content)
      } catch (parseError) {
        console.error(`[OllamaService] Failed to parse analysis response as JSON:`, content)
        return null
      }

      // Validate the response structure
      if (!parsedData || !parsedData.originalTitle || !parsedData.translations) {
        console.log(`[OllamaService] Invalid analysis response structure`)
        console.log(`[OllamaService] Raw response:`, content)

        // Fallback: Try to identify common title translations
        return this.fallbackTitleIdentification(searchResults, imdbId)
      }

      // If we have real title info, ensure the original title matches
      if (realTitleInfo && parsedData.originalTitle !== realTitleInfo.originalTitle) {
        console.log(
          `[OllamaService] LLM returned different title "${parsedData.originalTitle}", using real title "${realTitleInfo.originalTitle}"`
        )
        parsedData.originalTitle = realTitleInfo.originalTitle
      }

      // Save the inferred original title to database if we have an IMDb ID
      if (imdbId && parsedData.originalTitle) {
        await this.saveInferredTitleToDatabase(
          imdbId,
          parsedData.originalTitle,
          parsedData.translations
        )
      }

      // Create the result mapping
      const result: {
        [originalTitle: string]: { imdbId?: string; translations: { [langCode: string]: string } }
      } = {}
      result[parsedData.originalTitle] = {
        translations: parsedData.translations,
      }

      if (parsedData.imdbId || imdbId) {
        result[parsedData.originalTitle].imdbId = parsedData.imdbId || imdbId
      }

      console.log(
        `[OllamaService] Analysis complete: ${Object.keys(result).length} titles identified`
      )
      return result
    } catch (error) {
      console.error(`[OllamaService] Error analyzing search results:`, error)
      return null
    }
  }

  /**
   * Fallback method for title identification when LLM fails
   * Uses known title mappings for common cases
   */
  private static fallbackTitleIdentification(
    searchResults: string[],
    imdbId?: string
  ): {
    [originalTitle: string]: { imdbId?: string; translations: { [langCode: string]: string } }
  } | null {
    console.log(
      `[OllamaService] Using fallback title identification for ${searchResults.length} results`
    )

    // Extract the most common title from search results
    const titleCounts: { [title: string]: number } = {}
    const cleanTitles: string[] = []

    for (const result of searchResults) {
      // Clean the title (remove episode info, quality info, etc.)
      const cleanTitle = result.split('.')[0].split('S')[0].split('E')[0].trim()
      cleanTitles.push(cleanTitle)
      titleCounts[cleanTitle] = (titleCounts[cleanTitle] || 0) + 1
    }

    // Find the most common title
    let mostCommonTitle = ''
    let maxCount = 0
    for (const [title, count] of Object.entries(titleCounts)) {
      if (count > maxCount) {
        maxCount = count
        mostCommonTitle = title
      }
    }

    if (!mostCommonTitle) {
      console.log(`[OllamaService] Could not identify common title in fallback`)
      return null
    }

    console.log(
      `[OllamaService] Most common title in results: "${mostCommonTitle}" (appears ${maxCount} times)`
    )

    // If the title appears in all results and looks like it might be English, check if it's already the original
    const isAllResultsSame = maxCount === searchResults.length
    const looksEnglish =
      /^[A-Za-z\s\-\:\'\"]+$/.test(mostCommonTitle) &&
      !/[àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(mostCommonTitle.toLowerCase())

    if (isAllResultsSame && looksEnglish && mostCommonTitle.length > 3) {
      console.log(`[OllamaService] Title appears to already be in English: "${mostCommonTitle}"`)
      const result: {
        [originalTitle: string]: { imdbId?: string; translations: { [langCode: string]: string } }
      } = {}
      result[mostCommonTitle] = {
        translations: {},
      }

      if (imdbId) {
        result[mostCommonTitle].imdbId = imdbId
      }

      return result
    }

    // For non-English titles, assume they need translation but we don't know the original
    // Return null to indicate fallback failed - let the system handle it gracefully
    console.log(
      `[OllamaService] Title "${mostCommonTitle}" appears to be non-English but no mapping available`
    )
    return null
  }
}
