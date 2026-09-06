import { TitlesService } from '../repositories/titles_service.js'
import { io } from '../../start/socket-io.js'
import { titleProcessing } from '#config/app'
import { QueueService } from '#services/queue_service'
import { ProxyRequestService } from '#services/proxy_request_service'
import { QUEUES } from '../../queues.js'
import ExecutionLog from '#models/execution_log'
import LlmCache from '#models/llm_cache'
import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { UrlParserService } from '#services/url_parser_service'

@inject()
export default class ProxyController {
  constructor(
    private queueService: QueueService,
    private proxyRequestService: ProxyRequestService
  ) { }

  /**
   * Build the complete URL from the incoming request
   * Supports both hostname and hostname:port formats
   */
  private buildCompleteRequestUrl(request: HttpContext['request']): string {
    const protocol = request.protocol()
    const host = request.header('host') || 'localhost'
    const path = request.url()
    return `${protocol}://${host}${path}`
  }

  /**
   * Handle proxy requests to external services
   */
  public async handleProxyRequest({ params, request, response }: HttpContext) {
    console.log(`[PROXY_CONTROLLER] 🚀 REQUEST RECEIVED - ${request.method()} ${request.url()}`)

    const startTime = Date.now()
    const domain = params.domain
    const path = request.param('*').join('/')
    const query = request.qs()

    // Extract the full host (including port) from the request
    const fullHost = request.header('host') || 'localhost'

    console.log(`[PROXY_CONTROLLER] 🔍 Parsed request - Domain: ${domain}, Full Host: ${fullHost}, Path: ${path}, Query:`, query)

    // 1. Create Execution Log
    let executionLog = new ExecutionLog()
    try {
      executionLog.routeUrl = this.buildCompleteRequestUrl(request)
      executionLog.method = request.method()
      const requestBody = request.body()
      executionLog.requestBody = requestBody && Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : null
      executionLog.indexerName = domain
      executionLog.hostHeader = request.headers().host || null
      executionLog.searchQuery = query
      executionLog.status = 'processing'

      console.log(`[PROXY_CONTROLLER] 💾 Attempting to save execution log to SQLite...`)
      await executionLog.save()
      // Emitir evento realtime via socket.io
      io.emit('logs:new', executionLog.serialize())
      // Emitir evento WebSocket para novos logs
      console.log(`[PROXY_CONTROLLER] ✅ Execution log saved successfully - ID: ${executionLog.id}`)
      console.log(`[PROXY_CONTROLLER] 📊 SQLite record created with status: 'processing'`)
    } catch (e) {
      console.error('[PROXY_CONTROLLER] ❌ Failed to create execution log in SQLite:', e)
      console.error('[PROXY_CONTROLLER] 🚨 Database error - request will continue without logging')
    }

    console.log(`[ROUTE] Proxy route called - Domain: ${domain}, Path: ${path}, Query:`, query)

    // Extract IMDb ID from path if present (format: ttXXXXXXX:season:episode)
    let imdbId: string | undefined
    const imdbMatch = path.match(/tt\d+/)
    if (imdbMatch) {
      imdbId = imdbMatch[0]
      console.log(`[ROUTE] Extracted IMDb ID: ${imdbId}`)
    }

    // Build target URL using UrlParserService
    const url = await UrlParserService.buildProxyUrl(domain, path, query)

    // ========== PROXY REQUEST DEBUGGING ==========
    console.log('='.repeat(60))
    console.log('🚀 PROXY REQUEST - TARGET URL:')
    console.log(`   Method: ${request.method()}`)
    console.log(`   Domain: ${domain}`)
    console.log(`   Full Host: ${fullHost}`)
    console.log(`   Path: ${path}`)
    console.log(`   Query:`, query)
    console.log(`   Final URL: ${url}`)
    console.log('='.repeat(60))
    // =============================================

    console.log(`[ROUTE] Final URL to request: ${url}`)
    console.log('Proxying to:', url)

    // Update execution log with target URL
    if (executionLog) {
      console.log(`[PROXY_CONTROLLER] 🔄 Updating SQLite record with target URL...`)
      executionLog.targetUrl = url
      await executionLog.save()
      console.log(`[PROXY_CONTROLLER] ✅ SQLite record updated with targetUrl: ${url}`)
    }

    console.log(`[PROXY_CONTROLLER] 🌐 Making external HTTP request to: ${url}`)
    console.log(`[PROXY_CONTROLLER] 📡 Request method: ${request.method()}`)

    try {
      // Prepare headers - remove host header, let axios set it
      const { host, ...headersToForward } = request.headers()

      const proxyResponse = await this.proxyRequestService.proxyRequest(
        url,
        request.method(),
        request.body(),
        {
          ...headersToForward,
          host: domain, // Override host header for the target domain
        }
      )

      console.log(`[PROXY_CONTROLLER] 📥 External response received - Status: ${proxyResponse.status}`)
      console.log(
        `[PROXY_CONTROLLER] Response source: ${proxyResponse.fromCache ? 'DATABASE_CACHE' : 'EXTERNAL_SERVER'}`
      )

      // 2. Update Log with Original Response
      if (executionLog) {
        try {
          console.log(`[PROXY_CONTROLLER] 💾 Updating SQLite record with original response...`)
          const bodyStr =
            typeof proxyResponse.data === 'object'
              ? JSON.stringify(proxyResponse.data)
              : String(proxyResponse.data)
          executionLog.originalResponseBody =
            bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
          await executionLog.save()
          console.log(`[PROXY_CONTROLLER] ✅ SQLite record updated with original response (${bodyStr.length} chars)`)
        } catch (e) {
          console.error('[PROXY_CONTROLLER] ❌ Error updating log with original response:', e)
        }
      }

      console.log('Proxy response status:', proxyResponse.status)

      response.status(proxyResponse.status)

      // Forward all headers from the proxied response
      for (const [key, value] of Object.entries(proxyResponse.headers)) {
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
          response.header(key, value as any)
        }
      }

      // Apply LLM analysis and title replacement using TitlesService
      let responseData = proxyResponse.data
      if (proxyResponse.headers['content-type']?.includes('json') && responseData) {
        try {
          // First, apply LLM processing if enabled
          const enableOllamaProcessing = titleProcessing.enableOllamaProcessing
          if (enableOllamaProcessing) {
            // Check LLM Cache
            const llmCacheExpiry = titleProcessing.llmCacheExpiry
            const now = DateTime.now()

            // Prioritize finding cache by IMDb ID if available, otherwise by URL
            let cacheEntry: LlmCache | null = null
            if (imdbId) {
              cacheEntry = await LlmCache.query().where('imdb_id', imdbId).first()
            }
            if (!cacheEntry) {
              cacheEntry = await LlmCache.query().where('url', url).first()
            }

            let shouldProcessLLM = true
            if (cacheEntry) {
              const secondsSinceLastProcess = now.diff(
                cacheEntry.lastProcessedAt,
                'seconds'
              ).seconds
              if (secondsSinceLastProcess < llmCacheExpiry) {
                const source = cacheEntry.imdbId ? `IMDb: ${cacheEntry.imdbId}` : `URL`
                console.log(
                  `[PROXY_CONTROLLER] skipping LLM processing (found cache via ${source}, TTL: ${llmCacheExpiry}s, elapsed: ${Math.round(secondsSinceLastProcess)}s)`
                )
                shouldProcessLLM = false
              }
            }

            if (shouldProcessLLM) {
              if (titleProcessing.useQueuedLlm) {
                // Asynchronous processing via queues
                console.log('[PROXY_CONTROLLER] USE_QUEUED_LLM=true, publishing to queue')
                await this.queueService.ensureStarted()
                await this.queueService.publish(QUEUES.PROCESS_TITLES_ASYNC, {
                  responseData,
                  imdbId,
                  executionLogId: executionLog?.id,
                })
                console.log('[ROUTE] Published to async queue')

                if (executionLog) {
                  executionLog.status = 'queued_async'
                  await executionLog.save()
                }
              } else {
                // Synchronous processing
                console.log('[PROXY_CONTROLLER] USE_QUEUED_LLM=false, processing synchronously')

                // Pass executionLog to TitlesService
                responseData = await TitlesService.processSearchResultsWithLLM(
                  responseData,
                  'pt-BR',
                  imdbId,
                  executionLog // Pass the log entity
                )
                console.log('[ROUTE] LLM processing completed synchronously')
              }

              // Update LLM Cache (both URL and IMDb ID for maximum coverage)
              if (cacheEntry) {
                cacheEntry.lastProcessedAt = now
                if (imdbId) cacheEntry.imdbId = imdbId
                await cacheEntry.save()
              } else {
                await LlmCache.create({ url, imdbId, lastProcessedAt: now })
              }
            }
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

      // 3. Finalize Log (only if not queued - if queued, consumer finalizes it)
      if (executionLog && !titleProcessing.useQueuedLlm) {
        try {
          console.log(`[PROXY_CONTROLLER] 🎯 Finalizing SQLite record - processing completed`)
          const bodyStr =
            typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData)
          executionLog.processedResponseBody =
            bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
          executionLog.status = 'completed'
          executionLog.durationMs = Date.now() - startTime
          await executionLog.save()
          console.log(`[PROXY_CONTROLLER] ✅ SQLite record finalized - Status: 'completed', Duration: ${executionLog.durationMs}ms`)
          console.log(`[PROXY_CONTROLLER] 📊 Request processing completed successfully`)
        } catch (e) {
          console.error('[PROXY_CONTROLLER] ❌ Error finalizing log in SQLite:', e)
        }
      }

      console.log(`[PROXY_CONTROLLER] 📤 Sending response to client (${typeof responseData === 'string' ? responseData.length : JSON.stringify(responseData).length} chars)`)
      response.send(responseData)
    } catch (error) {
      console.error('[PROXY_CONTROLLER] ❌ Proxy error occurred:', error.message)
      console.error('[PROXY_CONTROLLER] 🔍 Error details:', {
        code: error.code,
        status: error.response?.status,
        url: url
      })

      // Update log with error
      if (executionLog) {
        try {
          console.log(`[PROXY_CONTROLLER] 💾 Updating SQLite record with error status...`)
          executionLog.status = 'failed'
          executionLog.durationMs = Date.now() - startTime
          await executionLog.save()
          console.log(`[PROXY_CONTROLLER] ✅ SQLite record updated with status: 'failed'`)
        } catch (e) {
          console.error('[PROXY_CONTROLLER] ❌ Error updating log with failure status:', e)
        }
      }

      console.log(`[PROXY_CONTROLLER] 🚨 Sending error response to client`)

      // Return more specific error information
      if (error.code === 'ECONNREFUSED') {
        response.status(502).send('Bad Gateway: Cannot connect to upstream server')
      } else if (error.code === 'ENOTFOUND') {
        response.status(502).send('Bad Gateway: Host not found')
      } else if (error.response) {
        response.status(error.response.status).send(error.response.data)
      } else {
        response.status(500).send('Proxy error: ' + error.message)
      }
    }
  }

  /**
   * Test proxy with a provided URL
   */
  public async testProxy({ request, response }: HttpContext) {
    const { url: testUrl } = request.body()

    if (!testUrl) {
      return response.status(400).send({ error: 'URL is required' })
    }

    try {
      // Parse the URL
      const urlObj = new URL(testUrl)
      const domain = urlObj.hostname
      const path = urlObj.pathname.substring(1) + urlObj.search // remove leading slash

      // Create a mock HttpContext-like object
      const mockRequest = {
        param: (key: string) => key === '*' ? path.split('/') : [],
        qs: () => Object.fromEntries(urlObj.searchParams),
        method: () => 'GET',
        body: () => ({}),
        headers: () => ({ host: urlObj.host }),
        protocol: () => urlObj.protocol.slice(0, -1), // remove ':'
        header: (name: string) => name === 'host' ? urlObj.host : undefined,
        url: () => urlObj.pathname + urlObj.search
      }

      // Call the existing handleProxyRequest logic
      // But since it's tightly coupled, I'll duplicate the logic here for simplicity
      // Actually, better to refactor, but for now, copy the logic

      const startTime = Date.now()

      // 1. Create Execution Log
      let executionLog = new ExecutionLog()
      try {
        executionLog.routeUrl = this.buildCompleteRequestUrl(mockRequest as any)
        executionLog.method = 'GET'
        executionLog.requestBody = null
        executionLog.indexerName = domain
        executionLog.searchQuery = mockRequest.qs()
        executionLog.status = 'processing'
        await executionLog.save()
        console.log(`[TEST_PROXY] Created execution log: ${executionLog.id}`)
      } catch (e) {
        console.error('Failed to create execution log', e)
      }

      console.log(`[TEST_PROXY] Testing proxy for URL: ${testUrl}`)

      // Extract IMDb ID
      let imdbId: string | undefined
      const imdbMatch = path.match(/tt\d+/)
      if (imdbMatch) {
        imdbId = imdbMatch[0]
      }

      // Build target URL
      const targetUrl = await UrlParserService.buildProxyUrl(domain, path, mockRequest.qs())

      if (executionLog) {
        executionLog.targetUrl = targetUrl
        await executionLog.save()
      }

      try {
        const proxyResponse = await this.proxyRequestService.proxyRequest(
          targetUrl,
          'GET',
          {},
          {
            host: domain,
          }
        )

        console.log(
          `[TEST_PROXY] Response source: ${proxyResponse.fromCache ? 'DATABASE_CACHE' : 'EXTERNAL_SERVER'}`
        )

        // Update log
        if (executionLog) {
          try {
            const bodyStr =
              typeof proxyResponse.data === 'object'
                ? JSON.stringify(proxyResponse.data)
                : String(proxyResponse.data)
            executionLog.originalResponseBody =
              bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
            await executionLog.save()
          } catch (e) {
            console.error('Error logging original response', e)
          }
        }

        response.status(proxyResponse.status)

        // Forward headers
        for (const [key, value] of Object.entries(proxyResponse.headers)) {
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
            response.header(key, value as any)
          }
        }

        // Apply processing
        let responseData = proxyResponse.data
        if (proxyResponse.headers['content-type']?.includes('json') && responseData) {
          try {
            const enableOllamaProcessing = titleProcessing.enableOllamaProcessing
            if (enableOllamaProcessing) {
              const llmCacheExpiry = titleProcessing.llmCacheExpiry
              const now = DateTime.now()

              let cacheEntry: LlmCache | null = null
              if (imdbId) {
                cacheEntry = await LlmCache.query().where('imdb_id', imdbId).first()
              }
              if (!cacheEntry) {
                cacheEntry = await LlmCache.query().where('url', targetUrl).first()
              }

              let shouldProcessLLM = true
              if (cacheEntry) {
                const secondsSinceLastProcess = now.diff(
                  cacheEntry.lastProcessedAt,
                  'seconds'
                ).seconds
                if (secondsSinceLastProcess < llmCacheExpiry) {
                  shouldProcessLLM = false
                }
              }

              if (shouldProcessLLM) {
                if (titleProcessing.useQueuedLlm) {
                  await this.queueService.ensureStarted()
                  await this.queueService.publish(QUEUES.PROCESS_TITLES_ASYNC, {
                    responseData,
                    imdbId,
                    executionLogId: executionLog?.id,
                  })

                  if (executionLog) {
                    executionLog.status = 'queued_async'
                    await executionLog.save()
                  }
                } else {
                  responseData = await TitlesService.processSearchResultsWithLLM(
                    responseData,
                    'pt-BR',
                    imdbId,
                    executionLog
                  )
                }

                if (cacheEntry) {
                  cacheEntry.lastProcessedAt = now
                  if (imdbId) cacheEntry.imdbId = imdbId
                  await cacheEntry.save()
                } else {
                  await LlmCache.create({ url: targetUrl, imdbId, lastProcessedAt: now })
                }
              }
            }

            responseData = await TitlesService.applyDatabaseTitleReplacements(responseData, 'pt-BR')
          } catch (error) {
            console.error('[TEST_PROXY] Error applying title processing:', error)
          }
        }

        // Finalize log
        if (executionLog && !titleProcessing.useQueuedLlm) {
          try {
            const bodyStr =
              typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData)
            executionLog.processedResponseBody =
              bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
            executionLog.status = 'completed'
            executionLog.durationMs = Date.now() - startTime
            await executionLog.save()
          } catch (e) {
            console.error('Error finalizing log', e)
          }
        }

        response.send(responseData)
      } catch (error) {
        console.error('Test proxy error:', error.message)

        if (executionLog) {
          try {
            executionLog.status = 'failed'
            executionLog.durationMs = Date.now() - startTime
            await executionLog.save()
          } catch (e) { }
        }

        if (error.code === 'ECONNREFUSED') {
          response.status(502).send('Bad Gateway: Cannot connect to upstream server')
        } else if (error.code === 'ENOTFOUND') {
          response.status(502).send('Bad Gateway: Host not found')
        } else if (error.response) {
          response.status(error.response.status).send(error.response.data)
        } else {
          response.status(500).send('Proxy error: ' + error.message)
        }
      }
    } catch (error) {
      return response.status(400).send({ error: 'Invalid URL' })
    }
  }
}
