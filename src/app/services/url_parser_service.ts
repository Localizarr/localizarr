export interface ParsedUrlParams {
  titleId?: string
  season?: number
  episode?: number
  mediaType?: 'movie' | 'tv'
}

export interface ParsedProxyUrl {
  domain: string
  path: string
  query: Record<string, any>
  fullUrl: string
}

export class UrlParserService {
  /**
   * Parse URL parameters from Torrentio-style requests
   * Example: /stream/series/tt13146488:2:7.json
   * Returns: { titleId: '13146488', season: 2, episode: 7, mediaType: 'tv' }
   */
  static parseTorrentioUrl(path: string): ParsedUrlParams {
    const params: ParsedUrlParams = {}

    // Look for patterns like /stream/series/tt13146488:2:7.json or /stream/movie/tt0111161.json
    const seriesMatch = path.match(/\/stream\/series\/tt(\d+):(\d+):(\d+)\.json/)
    const movieMatch = path.match(/\/stream\/movie\/tt(\d+)\.json/)

    if (seriesMatch) {
      params.titleId = seriesMatch[1]
      params.season = Number.parseInt(seriesMatch[2])
      params.episode = Number.parseInt(seriesMatch[3])
      params.mediaType = 'tv'
    } else if (movieMatch) {
      params.titleId = movieMatch[1]
      params.mediaType = 'movie'
    }

    return params
  }

  /**
   * Parse URL parameters from RARBG-style requests
   * Example: /get-posts/order:-a:time:10D:paginate_by:100:format:json
   * May contain TMDB IDs in query params or path
   */
  static parseRarbgUrl(_path: string, _query: Record<string, any>): ParsedUrlParams {
    // RARBG might have TMDB IDs in query params or path
    // This is a placeholder for future implementation
    // For now, return empty params
    return {}
  }

  /**
   * Generic URL parameter extraction
   * Tries different parsing strategies based on the domain/path pattern
   */
  static extractParams(domain: string, path: string, query: Record<string, any>): ParsedUrlParams {
    // Torrentio-specific parsing
    if (domain.includes('torrentio') || domain.includes('strem.fun')) {
      return this.parseTorrentioUrl(path)
    }

    // RARBG-specific parsing
    if (domain.includes('rarbg') || domain.includes('therarbg')) {
      return this.parseRarbgUrl(path, query)
    }

    // Default: try Torrentio parsing as fallback
    return this.parseTorrentioUrl(path)
  }

  /**
   * Parse a proxy route URL (format: /_/domain.com/path?query=1)
   * into its components
   */
  static async parseProxyRoute(routeUrl: string): Promise<ParsedProxyUrl> {
    if (!routeUrl.startsWith('/_/')) {
      throw new Error('Invalid proxy route URL format')
    }

    const urlParts = routeUrl.substring(3).split('?') // Remove /_/ and split query
    const pathAndDomain = urlParts[0]
    const queryString = urlParts[1] || ''

    const pathParts = pathAndDomain.split('/')
    const domain = pathParts[0]
    const path = pathParts.slice(1).join('/')

    const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}

    // Fix double slash issue - ensure path doesn't start with /
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const protocol = await this.getProxyProtocol()
    const fullUrl = `${protocol}://${domain}/${cleanPath}${queryString ? '?' + queryString : ''}`

    return {
      domain,
      path: cleanPath,
      query,
      fullUrl,
    }
  }

  /**
   * Build a proxy URL from components
   */
  static async buildProxyUrl(domain: string, path: string, query?: Record<string, any>): Promise<string> {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const queryString = query && Object.keys(query).length > 0
      ? '?' + new URLSearchParams(query).toString()
      : ''

    const protocol = await this.getProxyProtocol()
    return `${protocol}://${domain}/${cleanPath}${queryString}`
  }

  /**
   * Extract IMDb ID from a path if present
   */
  static extractImdbId(path: string): string | undefined {
    const imdbMatch = path.match(/tt\d+/)
    return imdbMatch ? imdbMatch[0] : undefined
  }

  /**
   * Validate if a URL is a valid proxy target
   */
  static isValidProxyUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }

  /**
   * Get proxy protocol from config
   */
  private static async getProxyProtocol(): Promise<string> {
    // Import here to avoid circular dependencies
    const { default: serverConfig } = await import('#config/servers')
    return serverConfig.proxyProtocol
  }
}
