import axios from 'axios'
import serverConfig from '#config/servers'
import { TitlesService } from '../repositories/titles_service.js'
import { titleProcessing } from '#config/app'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProxyController {
  /**
   * Handle proxy requests to external services
   */
  public async handleProxyRequest({ params, request, response }: HttpContext) {
    const domain = params.domain
    const path = request.param('*').join('/')
    const query = request.qs()

    console.log(`[ROUTE] Proxy route called - Domain: ${domain}, Path: ${path}, Query:`, query)

    // Extract IMDb ID from path if present (format: ttXXXXXXX:season:episode)
    let imdbId: string | undefined
    const imdbMatch = path.match(/tt\d+/)
    if (imdbMatch) {
      imdbId = imdbMatch[0]
      console.log(`[ROUTE] Extracted IMDb ID: ${imdbId}`)
    }

    // Fix double slash issue - ensure path doesn't start with /
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const url = `${serverConfig.proxyProtocol}://${domain}/${cleanPath}${query && Object.keys(query).length > 0 ? '?' + new URLSearchParams(query).toString() : ''}`

    console.log(`[ROUTE] Final URL to request: ${url}`)
    console.log('Proxying to:', url)
    console.log('Method:', request.method())
    console.log('Query params:', query)

    try {
      // Prepare headers - remove host header, let axios set it
      const { host, ...headersToForward } = request.headers()

      const proxyResponse = await axios({
        method: request.method(),
        url: url,
        headers: {
          ...headersToForward,
          host: domain, // Override host header for the target domain
        },
        data: request.body(),
        validateStatus: () => true, // Allow any status code
        timeout: 30000, // 30 second timeout
      })

      console.log('Proxy response status:', proxyResponse.status)

      response.status(proxyResponse.status)

      // Forward all headers from the proxied response
      for (const [key, value] of Object.entries(proxyResponse.headers)) {
        // Skip hop-by-hop headers that shouldn't be forwarded
        if (
          ![
            'connection',
            'keep-alive',
            'proxy-authenticate',
            'proxy-authorization',
            'te',
            'trailers',
            'transfer-encoding',
            'upgrade',
          ].includes(key.toLowerCase())
        ) {
          response.header(key, value)
        }
      }

      // Apply LLM analysis and title replacement using TitlesService
      let responseData = proxyResponse.data
      if (proxyResponse.headers['content-type']?.includes('json') && responseData) {
        try {
          // First, apply LLM processing if enabled
          const enableOllamaProcessing = titleProcessing.enableOllamaProcessing
          if (enableOllamaProcessing) {
            console.log('[ROUTE] Applying LLM analysis using TitlesService')
            responseData = await TitlesService.processSearchResultsWithLLM(
              responseData,
              'pt-BR',
              imdbId
            )
            console.log('[ROUTE] LLM analysis applied successfully')
          } else {
            console.log('[ROUTE] LLM processing disabled via application configuration')
          }

          // Then, apply database-based title replacements (independent of LLM processing)
          console.log('[ROUTE] Applying database-based title replacement using TitlesService')
          responseData = await TitlesService.applyDatabaseTitleReplacements(responseData, 'pt-BR')
          console.log('[ROUTE] Database-based title replacement applied successfully')
        } catch (error) {
          console.error('[ROUTE] Error applying title processing:', error)
          // Continue with original data if service fails
        }
      }

      response.send(responseData)
    } catch (error) {
      console.error('Proxy error:', error.message)
      console.error('Error details:', error)

      // Return more specific error information
      if (error.code === 'ECONNREFUSED') {
        response.status(502).send('Bad Gateway: Cannot connect to upstream server')
      } else if (error.code === 'ENOTFOUND') {
        response.status(502).send('Bad Gateway: Host not found')
      } else if (error.response) {
        // If axios got a response, forward it
        response.status(error.response.status).send(error.response.data)
      } else {
        response.status(500).send('Proxy error: ' + error.message)
      }
    }
  }
}
