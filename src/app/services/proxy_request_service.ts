import axios from 'axios'
import ProxyCache from '#models/proxy_cache'
import { DateTime } from 'luxon'
import { indexerCache } from '#config/app'
import { inject } from '@adonisjs/core'
import { Logger } from '@adonisjs/core/logger'

export interface ProxyRequestOptions {
  method?: string
  data?: any
  headers?: any
  timeout?: number
}

export interface ProxyResponse {
  data: any
  status: number
  headers: any
  fromCache: boolean
  cachedAt?: DateTime
  expiresAt?: DateTime
}

@inject()
export class ProxyRequestService {
  private userAgent = 'UmlautAdaptarr/1.0'

  constructor(private logger: Logger) {}

  /**
   * Example of how to use the stream heartbeat timeout configuration:
   *
   * const heartbeatTimeout = streamConfig.heartbeatTimeoutMs // 120000ms (2 minutes)
   *
   * // For SSE streams, WebSocket connections, or long-running HTTP requests
   * const controller = new AbortController()
   * const timeoutId = setTimeout(() => controller.abort(), heartbeatTimeout)
   *
   * try {
   *   const response = await fetch(url, {
   *     signal: controller.signal,
   *     // ... other options
   *   })
   * } finally {
   *   clearTimeout(timeoutId)
   * }
   */

  async proxyRequest(
    targetUri: string,
    options: ProxyRequestOptions = {}
  ): Promise<ProxyResponse> {
    const { method = 'GET', data = null, headers = {}, timeout } = options

    // Check cache first
    const cacheResult = await this.getCachedResponse(targetUri, method)
    if (cacheResult) {
      this.logger.info('Proxy cache hit', { url: targetUri, method })
      return cacheResult
    }

    this.logger.info('Proxy cache miss - fetching fresh data', { url: targetUri, method })

    // Make external request
    const response = await this.makeExternalRequest(targetUri, { method, data, headers, timeout })

    // Cache response asynchronously
    this.cacheResponseAsync(targetUri, method, response)

    return {
      data: response.data,
      status: response.status,
      headers: {
        ...response.headers,
        'X-Proxy-Cache': 'MISS',
      },
      fromCache: false,
    }
  }

  private async getCachedResponse(targetUri: string, method: string): Promise<ProxyResponse | null> {
    try {
      const now = DateTime.now().toSQL()
      const cached = await ProxyCache.query()
        .where('url', targetUri)
        .where('method', method.toUpperCase())
        .where('expires_at', '>', now!)
        .first()

      if (!cached) return null

      const cachedHeaders = this.parseCachedHeaders(cached.responseHeaders)
      const responseData = this.parseCachedBody(cached.responseBody, cachedHeaders)

      return {
        data: responseData,
        status: cached.statusCode,
        headers: {
          ...cachedHeaders,
          'X-Proxy-Cache': 'HIT',
        },
        fromCache: true,
        cachedAt: cached.createdAt,
        expiresAt: cached.expiresAt,
      }
    } catch (error) {
      this.logger.warn('Error retrieving cached response', { url: targetUri, method, error })
      return null
    }
  }

  private parseCachedHeaders(responseHeaders: string): any {
    try {
      return typeof responseHeaders === 'string'
        ? JSON.parse(responseHeaders)
        : responseHeaders
    } catch (error) {
      this.logger.warn('Error parsing cached headers', { error })
      return {}
    }
  }

  private parseCachedBody(responseBody: string, headers: any): any {
    const contentType = (headers['content-type'] || '').toLowerCase()

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(responseBody)
      } catch (error) {
        this.logger.warn('Error parsing cached JSON body', { error })
      }
    }

    return responseBody
  }

  private async makeExternalRequest(
    targetUri: string,
    options: ProxyRequestOptions
  ): Promise<any> {
    const { method = 'GET', data = null, headers = {} } = options
    const { host, ...headersToForward } = headers

    this.logger.debug('Making external HTTP request', {
      method,
      url: targetUri,
      userAgent: this.userAgent,
      host: new URL(targetUri).host,
      hasBody: !!data
    })

    try {
      const response = await axios({
        method,
        url: targetUri,
        data,
        headers: {
          'User-Agent': this.userAgent,
          ...headersToForward,
          'host': new URL(targetUri).host,
        },
        validateStatus: () => true,
        timeout: options.timeout || 30000, // 30 second default timeout
      })

      this.logger.debug('External request completed', {
        status: response.status,
        contentLength: response.headers['content-length']
      })

      return response
    } catch (error) {
      this.logger.error('External request failed', {
        url: targetUri,
        method,
        error: error.message,
        code: error.code
      })
      throw error
    }
  }

  private async cacheResponseAsync(
    targetUri: string,
    method: string,
    response: any
  ): Promise<void> {
    try {
      // Determine cache TTL based on response status
      const isSuccess = response.status >= 200 && response.status < 300
      const ttlSeconds = isSuccess ? indexerCache.successTtlSeconds : indexerCache.errorTtlSeconds
      const expiresAt = DateTime.now().plus({ seconds: ttlSeconds })
      const now = DateTime.now().toSQL()

      // Clean up expired entries first
      await this.cleanupExpiredCache(targetUri, method, now!)

      // Cache the new response
      await ProxyCache.create({
        url: targetUri,
        method: method.toUpperCase(),
        responseBody: this.serializeResponseBody(response.data),
        responseHeaders: JSON.stringify(response.headers),
        statusCode: response.status,
        expiresAt,
      })

      this.logger.debug('Response cached successfully', {
        url: targetUri,
        method,
        status: response.status,
        ttlSeconds
      })
    } catch (error) {
      this.logger.error('Failed to cache response', {
        url: targetUri,
        method,
        error: error.message
      })
    }
  }

  private async cleanupExpiredCache(targetUri: string, method: string, now: string): Promise<void> {
    try {
      const deletedRows = await ProxyCache.query()
        .where('url', targetUri)
        .where('method', method.toUpperCase())
        .where('expires_at', '<=', now)
        .delete()

      if (deletedRows.length > 0) {
        this.logger.debug('Cleaned up expired cache entries', { url: targetUri, method, deletedCount: deletedRows.length })
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup expired cache', { error: error.message })
    }
  }

  private serializeResponseBody(data: any): string {
    return typeof data === 'object' ? JSON.stringify(data) : String(data)
  }
}
