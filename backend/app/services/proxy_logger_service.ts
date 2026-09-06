import { Logger } from '@adonisjs/core/logger'
import { inject } from '@adonisjs/core'

export interface LogContext {
  url?: string
  method?: string
  domain?: string
  status?: number
  duration?: number
  fromCache?: boolean
  error?: string
  [key: string]: any
}

@inject()
export class ProxyLoggerService {
  constructor(private logger: Logger) { }

  /**
   * Log proxy request initiation
   */
  logProxyRequest(context: LogContext) {
    this.logger.info('🚀 Proxy request initiated', {
      method: context.method,
      domain: context.domain,
      url: context.url?.substring(0, 100) + (context.url && context.url.length > 100 ? '...' : ''),
    })
  }

  /**
   * Log external HTTP request
   */
  logExternalRequest(context: LogContext) {
    this.logger.debug('🌐 External HTTP request', {
      method: context.method,
      url: context.url,
      userAgent: 'UmlautAdaptarr/1.0',
      host: context.domain,
    })
  }

  /**
   * Log cache operations
   */
  logCacheOperation(operation: 'hit' | 'miss' | 'stored', context: LogContext) {
    const emoji = operation === 'hit' ? '✅' : operation === 'miss' ? '❌' : '💾'
    const level = operation === 'hit' ? 'info' : 'debug'

    this.logger[level](`${emoji} Cache ${operation}`, {
      url: context.url,
      method: context.method,
      status: context.status,
      ttl: context.ttl,
    })
  }

  /**
   * Log response processing
   */
  logResponseProcessing(context: LogContext) {
    this.logger.debug('📦 Response processed', {
      status: context.status,
      contentType: context.contentType,
      size: context.size,
      fromCache: context.fromCache,
    })
  }

  /**
   * Log LLM processing
   */
  logLlmProcessing(stage: string, context: LogContext) {
    this.logger.info(`🤖 LLM ${stage}`, {
      imdbId: context.imdbId,
      queued: context.queued,
      duration: context.duration,
    })
  }

  /**
   * Log replay operations
   */
  logReplayOperation(context: LogContext) {
    this.logger.info('🔄 Replay executed', {
      originalLogId: context.originalLogId,
      method: context.method,
      url: context.url,
      status: context.status,
    })
  }

  /**
   * Log errors
   */
  logError(operation: string, error: Error, context?: LogContext) {
    this.logger.error(`❌ ${operation} failed`, {
      error: error.message,
      stack: error.stack?.split('\n')[0], // Only first line of stack
      ...context,
    })
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, context?: LogContext) {
    this.logger.info(`⚡ ${operation} completed`, {
      duration: `${duration}ms`,
      ...context,
    })
  }
}
