export interface ParsedUrlParams {
  titleId?: string
  season?: number
  episode?: number
  mediaType?: 'movie' | 'tv'
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
}
