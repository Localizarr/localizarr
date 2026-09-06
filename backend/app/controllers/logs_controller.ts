import type { HttpContext } from '@adonisjs/core/http'
import ExecutionLog from '#models/execution_log'
import serverConfig from '#config/servers'
import { TitlesService } from '../repositories/titles_service.js'
import { titleProcessing } from '#config/app'
import { QueueService } from '#services/queue_service'
import { QUEUES } from '../../queues.js'
import { ProxyRequestService } from '#services/proxy_request_service'
import { inject } from '@adonisjs/core'

@inject()
export default class LogsController {
  constructor(
    private queueService: QueueService,
    private proxyRequestService: ProxyRequestService
  ) { }

  async index({ request }: HttpContext) {
    const page = request.input('page', 1)
    const limit = Math.min(Math.max(request.input('limit', 20), 10), 100) // Min 10, max 100, default 20

    const logs = await ExecutionLog.query().orderBy('created_at', 'desc').paginate(page, limit)

    const serializedLogs = logs.serialize()
    console.log(`[LogsController] Page: ${page}, Limit: ${limit}`)
    console.log(`[LogsController] Fetched ${serializedLogs.data.length} logs`)
    if (serializedLogs.data.length > 0) {
      console.log(`[LogsController] First log ID: ${serializedLogs.data[0].id}`)
    }

    return {
      success: true,
      data: serializedLogs
    }
  }

  async replay({ params, response, session }: HttpContext) {
    const logId = params.id
    const log = await ExecutionLog.find(logId)
    if (!log) {
      session.flash('error', 'Log not found')
      return response.redirect('/logs')
    }

    // Parse routeUrl to extract domain, path, query
    const routeUrl = log.routeUrl
    if (!routeUrl.startsWith('/_/')) {
      session.flash('error', 'Invalid log route URL')
      return response.redirect('/logs')
    }

    const urlParts = routeUrl.substring(3).split('?') // Remove /_/ and split query
    const pathAndDomain = urlParts[0]
    const queryString = urlParts[1] || ''

    const pathParts = pathAndDomain.split('/')
    const domain = pathParts[0]
    const path = pathParts.slice(1).join('/')

    const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}

    console.log(`[REPLAY] Domain: ${domain}, Path: ${path}, Query:`, query)

    // Extract IMDb ID if present
    let imdbId: string | undefined
    const imdbMatch = path.match(/tt\d+/)
    if (imdbMatch) {
      imdbId = imdbMatch[0]
    }

    // Create new execution log for replay
    let replayLog = new ExecutionLog()
    replayLog.routeUrl = routeUrl
    replayLog.indexerName = domain
    replayLog.searchQuery = query
    replayLog.status = 'processing'
    await replayLog.save()
    console.log(`[REPLAY] Created replay log: ${replayLog.id}`)

    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const targetUrl = `${serverConfig.proxyProtocol}://${domain}/${cleanPath}${queryString ? '?' + queryString : ''}`

    replayLog.targetUrl = targetUrl
    await replayLog.save()

    try {
      // Simulate proxy request
      const proxyResponse = await this.proxyRequestService.proxyRequest(
        targetUrl,
        'GET', // Assume GET for replay
        null,
        { host: domain }
      )

      // Log original response
      const bodyStr = typeof proxyResponse.data === 'object' ? JSON.stringify(proxyResponse.data) : String(proxyResponse.data)
      replayLog.originalResponseBody = bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
      await replayLog.save()

      // Apply processing
      let responseData = proxyResponse.data
      if (proxyResponse.headers['content-type']?.includes('json') && responseData) {
        const enableOllamaProcessing = titleProcessing.enableOllamaProcessing
        if (enableOllamaProcessing) {
          if (titleProcessing.useQueuedLlm) {
            await this.queueService.ensureStarted()
            await this.queueService.publish(QUEUES.PROCESS_TITLES_ASYNC, {
              responseData,
              imdbId,
              executionLogId: replayLog.id,
            })
            replayLog.status = 'queued_async'
          } else {
            responseData = await TitlesService.processSearchResultsWithLLM(responseData, 'pt-BR', imdbId, replayLog)
            replayLog.status = 'completed'
          }
        } else {
          responseData = await TitlesService.applyDatabaseTitleReplacements(responseData, 'pt-BR')
          replayLog.status = 'completed'
        }
      } else {
        replayLog.status = 'completed'
      }

      if (replayLog.status === 'completed') {
        const processedStr = typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData)
        replayLog.processedResponseBody = processedStr.length > 50000 ? processedStr.substring(0, 50000) + '...[TRUNCATED]' : processedStr
        replayLog.durationMs = Date.now() - replayLog.createdAt.toMillis()
      }

      await replayLog.save()

      session.flash('success', `Replay executed successfully. New log ID: ${replayLog.id}`)
      return response.redirect('/logs')
    } catch (error) {
      console.error('Replay error:', error.message)
      replayLog.status = 'failed'
      replayLog.durationMs = Date.now() - replayLog.createdAt.toMillis()
      await replayLog.save()

      session.flash('error', `Replay failed: ${error.message}`)
      return response.redirect('/logs')
    }
  }
}
