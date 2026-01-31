import axios from 'axios'
import ProxyCache from '#models/proxy_cache'
import { DateTime } from 'luxon'
import { indexerCache } from '#config/app'
import { inject } from '@adonisjs/core'

@inject()
export class ProxyRequestService {
  private userAgent = 'UmlautAdaptarr/1.0'

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
    method: string = 'GET',
    data: any = null,
    headers: any = {}
  ): Promise<{ data: any; status: number; headers: any; fromCache: boolean }> {
    // Check cache in SQLite
    const now = DateTime.now().toSQL()
    const cached = await ProxyCache.query()
      .where('url', targetUri)
      .where('method', method.toUpperCase())
      .where('expires_at', '>', now!)
      .first()

    if (cached) {
      console.log(`[ProxyRequestService] [CACHE HIT] Returning cached response for: ${targetUri}`)
      try {
        const cachedHeaders =
          typeof cached.responseHeaders === 'string'
            ? JSON.parse(cached.responseHeaders)
            : cached.responseHeaders
        const contentType = (cachedHeaders['content-type'] || '').toLowerCase()

        let responseData = cached.responseBody
        if (contentType.includes('application/json')) {
          try {
            responseData = JSON.parse(cached.responseBody)
          } catch (e) {
            // Not actually JSON or malformed, keep as string
          }
        }

        return {
          data: responseData,
          status: cached.statusCode,
          headers: {
            ...cachedHeaders,
            'X-Proxy-Cache': 'HIT',
          },
          fromCache: true,
        }
      } catch (e) {
        console.error('[ProxyRequestService] Error processing cached response', e)
      }
    }

    console.log(`[ProxyRequestService] [CACHE MISS] Fetching fresh data for: ${targetUri}`)
    const { host, ...headersToForward } = headers
    const response = await axios({
      method: method,
      url: targetUri,
      data: data,
      headers: {
        'User-Agent': this.userAgent,
        ...headersToForward,
        'host': new URL(targetUri).host,
      },
      validateStatus: () => true,
    })

    // Determine cache TTL based on response status
    const isSuccess = response.status >= 200 && response.status < 300
    const ttlSeconds = isSuccess ? indexerCache.successTtlSeconds : indexerCache.errorTtlSeconds
    const expiresAt = DateTime.now().plus({ seconds: ttlSeconds })

    console.log(`[ProxyRequestService] Caching response (status: ${response.status}) for ${ttlSeconds} seconds`)

    // Cache the response asynchronously (don't block the response)
    this.cacheResponseAsync(targetUri, method, response, expiresAt, now!)

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

  /**
   * Cache response asynchronously without blocking the main request flow
   */
  private async cacheResponseAsync(
    targetUri: string,
    method: string,
    response: any,
    expiresAt: DateTime,
    now: string
  ): Promise<void> {
    try {
      // Delete only expired cache entries for this URL/method
      await ProxyCache.query()
        .where('url', targetUri)
        .where('method', method.toUpperCase())
        .where('expires_at', '<=', now)
        .delete()

      await ProxyCache.create({
        url: targetUri,
        method: method.toUpperCase(),
        responseBody:
          typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data),
        responseHeaders: JSON.stringify(response.headers),
        statusCode: response.status,
        expiresAt: expiresAt,
      })

      console.log(`[ProxyRequestService] Successfully cached response for: ${targetUri}`)
    } catch (e) {
      console.error('[ProxyRequestService] Error saving to cache asynchronously', e)
    }
  }
}
