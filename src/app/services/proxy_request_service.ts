import axios from 'axios'
import ProxyCache from '#models/proxy_cache'
import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'

@inject()
export class ProxyRequestService {
  private userAgent = 'UmlautAdaptarr/1.0'

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
        const cachedHeaders = typeof cached.responseHeaders === 'string' ? JSON.parse(cached.responseHeaders) : cached.responseHeaders
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
        host: new URL(targetUri).hostname,
      },
      validateStatus: () => true,
    })

    // Cache for 12 minutes
    const expiresAt = DateTime.now().plus({ minutes: 12 })

    try {
      // Delete old cache entry if exists
      await ProxyCache.query()
        .where('url', targetUri)
        .where('method', method.toUpperCase())
        .delete()

      await ProxyCache.create({
        url: targetUri,
        method: method.toUpperCase(),
        responseBody: typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data),
        responseHeaders: JSON.stringify(response.headers),
        statusCode: response.status,
        expiresAt: expiresAt,
      })
    } catch (e) {
      console.error('[ProxyRequestService] Error saving to cache', e)
    }

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
}
