import Title from '#models/title'
import LocalizedName from '#models/localized_name'
import { OllamaService } from '#services/ollama_service'

export class TitlesService {
  private static titleReplacements = new Map<string, string>()

  /**
   * Replace localized text from response
   * Should receive the response data and apply title replacements based on cached/localized data
   * Converts localized titles back to original titles for Sonarr/Radarr compatibility
   */
  static async replaceLocalizedTextInResponse(
    responseData: any,
    targetLangId: string = 'pt-BR'
  ): Promise<any> {
    if (!responseData) return responseData

    console.log(
      `[TitlesService] Processing response for localized to original text replacement (lang: ${targetLangId})`
    )

    // Ensure we have the latest replacements loaded
    await this.ensureReplacementsLoaded(targetLangId)

    let replacementsCount = 0

    // Process different response formats
    if (responseData.results && Array.isArray(responseData.results)) {
      // RARBG-like format
      console.log(`[TitlesService] Processing RARBG results array`)
      responseData.results = responseData.results.map((item: any) => {
        return this.processItemForReplacement(item, 'n')
      })
    } else if (responseData.streams && Array.isArray(responseData.streams)) {
      // Torrentio-like format
      console.log(`[TitlesService] Processing Torrentio streams array`)
      responseData.streams = responseData.streams.map((item: any) => {
        return this.processItemForReplacement(item, 'title')
      })
    }

    console.log(
      `[TitlesService] Completed localized to original text replacement. ${replacementsCount} replacements made`
    )
    return responseData
  }

  /**
   * Ensure title replacements are loaded from database
   * Maps localized titles back to original titles
   */
  private static async ensureReplacementsLoaded(targetLangId: string): Promise<void> {
    if (this.titleReplacements.size === 0) {
      console.log(
        `[TitlesService] Loading title replacements from database for lang: ${targetLangId}`
      )

      try {
        // Get all localized names for the target language
        const localizedNames = await LocalizedName.query()
          .where('langId', targetLangId)
          .preload('title')

        this.titleReplacements.clear()

        for (const localizedName of localizedNames) {
          const title = localizedName.title

          // Add mapping from localized name to original title (reverse replacement)
          // Append language code in brackets to help user identify the replacement
          this.titleReplacements.set(localizedName.localizedName, `${title.originalTitle}.${localizedName.langId}`)
        }

        console.log(`[TitlesService] Loaded ${this.titleReplacements.size} title replacements`)
      } catch (error) {
        console.log(`[TitlesService] Database not available or not initialized (this is normal in test environments):`, error.message)
        this.titleReplacements.clear()
      }
    }
  }

  /**
   * Process search results through LLM analysis and store identified titles/translations
   * This should be called BEFORE sending the final response to the client
   */
  static async processSearchResultsWithLLM(
    responseData: any,
    targetLangId: string = 'pt-BR',
    imdbId?: string,
    executionLog?: any
  ): Promise<any> {
    if (!responseData) return responseData

    console.log(
      `[TitlesService] Processing search results with LLM for language: ${targetLangId}${imdbId ? ` (IMDb: ${imdbId})` : ''}`
    )

    try {
      // Extract titles from response data
      const titles = this.extractTitlesFromResponse(responseData)

      if (titles.length === 0) {
        console.log(`[TitlesService] No titles found in response data`)
        return responseData
      }

      console.log(`[TitlesService] Extracted ${titles.length} titles for LLM analysis`)
      console.log(`[TitlesService] Titles before LLM processing:`, titles)

      // Send to LLM for analysis with IMDb ID if available
      const analysisResult = await OllamaService.analyzeSearchResults(titles, imdbId, executionLog)

      if (!analysisResult) {
        console.log(`[TitlesService] LLM analysis returned no results`)
        return responseData
      }

      // Log detected languages from LLM analysis
      const detectedLanguages = new Set<string>()
      for (const [, data] of Object.entries(analysisResult)) {
        Object.keys(data.translations).forEach((lang) => detectedLanguages.add(lang))
      }
      console.log(`[TitlesService] Languages detected by LLM:`, Array.from(detectedLanguages))

      // Store identified titles and translations in database
      await this.storeLLMAnalysisResults(analysisResult)

      // Clear the replacements cache so it reloads with new data
      this.titleReplacements.clear()

      console.log(`[TitlesService] LLM analysis completed and stored in database`)
      console.log(`[TitlesService] LLM identified mappings:`, analysisResult)

      return responseData
    } catch (error) {
      console.error(`[TitlesService] Error processing search results with LLM:`, error)
      // Return original response if LLM processing fails
      return responseData
    }
  }

  /**
   * Apply database-based title replacements to response data
   * This should be called AFTER LLM processing to apply stored translations
   */
  static async applyDatabaseTitleReplacements(
    responseData: any,
    targetLangId: string = 'pt-BR'
  ): Promise<any> {
    if (!responseData) return responseData

    console.log(`[TitlesService] Starting database-based title replacement after LLM processing`)

    // Apply the localized to original text replacement
    const processedResponse = await this.replaceLocalizedTextInResponse(responseData, targetLangId)
    console.log(`[TitlesService] Database-based text replacement completed`)

    // Log titles after replacement
    const processedTitles = this.extractTitlesFromResponse(processedResponse)
    console.log(`[TitlesService] Titles after replacement processing:`, processedTitles)

    return processedResponse
  }

  /**
   * Extract titles from different response formats
   */
  static extractTitlesFromResponse(responseData: any): string[] {
    const titles: string[] = []

    if (responseData.results && Array.isArray(responseData.results)) {
      // RARBG-like format
      responseData.results.forEach((item: any) => {
        if (item.n && typeof item.n === 'string') {
          titles.push(item.n)
        }
      })
    } else if (responseData.streams && Array.isArray(responseData.streams)) {
      // Torrentio-like format
      responseData.streams.forEach((item: any) => {
        if (item.title && typeof item.title === 'string') {
          titles.push(item.title)
        }
      })
    }

    // Remove duplicates
    return [...new Set(titles)]
  }

  /**
   * Store LLM analysis results in database
   */
  private static async storeLLMAnalysisResults(analysisResult: {
    [originalTitle: string]: {
      imdbId?: string
      translations: { [langCode: string]: string }
    }
  }): Promise<void> {
    console.log(`[TitlesService] Storing LLM analysis results in database`)

    for (const [originalTitle, data] of Object.entries(analysisResult)) {
      try {
        // Find or create the title
        let title = await Title.query().where('original_title', originalTitle).first()

        if (!title && data.imdbId) {
          // Try to find by IMDb ID if provided
          title = await Title.query().where('imdb_id', data.imdbId).first()
        }

        if (!title) {
          // Create new title
          title = await Title.create({
            imdbId: data.imdbId || `unknown_${Date.now()}`,
            mediaType: 'tv', // Default to TV
            originalTitle: originalTitle,
          })
          console.log(`[TitlesService] Created new title: ${originalTitle}`)
        } else {
          // Update original title only if it's empty or null
          if (!title.originalTitle || title.originalTitle.trim() === '') {
            title.originalTitle = originalTitle
            await title.save()
            console.log(`[TitlesService] Updated empty title: ${originalTitle}`)
          } else {
            console.log(`[TitlesService] Title already has value, skipping update: ${originalTitle}`)
          }
        }

        // Store translations
        const savedLanguages: string[] = []
        for (const [langCode, translatedTitle] of Object.entries(data.translations)) {
          if (translatedTitle && translatedTitle.trim()) {
            const existingLocalized = await LocalizedName.query()
              .where('titleId', title.id)
              .where('langId', langCode)
              .first()

            if (existingLocalized) {
              if (existingLocalized.localizedName !== translatedTitle.trim()) {
                await existingLocalized.merge({ localizedName: translatedTitle.trim() }).save()
                console.log(
                  `[TitlesService] Updated translation for ${langCode}: ${translatedTitle.trim()}`
                )
                savedLanguages.push(langCode)
              }
            } else {
              await LocalizedName.create({
                titleId: title.id,
                langId: langCode,
                localizedName: translatedTitle.trim(),
              })
              console.log(
                `[TitlesService] Created translation for ${langCode}: ${translatedTitle.trim()}`
              )
              savedLanguages.push(langCode)
            }
          }
        }

        if (savedLanguages.length > 0) {
          console.log(
            `[TitlesService] Languages saved to database for "${originalTitle}":`,
            savedLanguages
          )
        }

        // Clear cache for this title (removed - no longer using cache)
      } catch (error) {
        console.error(`[TitlesService] Error storing analysis result for ${originalTitle}:`, error)
      }
    }
  }

  /**
   * Process a single item for title replacement
   */
  private static processItemForReplacement(item: any, titleField: string): any {
    if (item[titleField] && typeof item[titleField] === 'string') {
      const originalTitle = item[titleField]
      let modifiedTitle = originalTitle

      // Apply all title replacements
      for (const [original, replacement] of this.titleReplacements) {
        if (modifiedTitle.includes(original)) {
          modifiedTitle = modifiedTitle.replace(
            new RegExp(this.escapeRegExp(original), 'gi'),
            replacement
          )
          console.log(`[TitlesService] "${original}" -> "${replacement}" in "${originalTitle}"`)
        }
      }

      if (originalTitle !== modifiedTitle) {
        item[titleField] = modifiedTitle
      }
    }

    // Process nested objects
    this.processNestedStrings(item)

    return item
  }

  /**
   * Process nested string fields recursively
   */
  private static processNestedStrings(obj: any): void {
    if (!obj || typeof obj !== 'object') return

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key]

        if (typeof value === 'string') {
          let modifiedValue = value
          for (const [original, replacement] of this.titleReplacements) {
            if (modifiedValue.includes(original)) {
              modifiedValue = modifiedValue.replace(
                new RegExp(this.escapeRegExp(original), 'gi'),
                replacement
              )
              console.log(`[TitlesService] "${original}" -> "${replacement}" in nested field`)
            }
          }
          if (value !== modifiedValue) {
            obj[key] = modifiedValue
          }
        } else if (typeof value === 'object') {
          this.processNestedStrings(value)
        }
      }
    }
  }

  // Private helper methods

  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}
