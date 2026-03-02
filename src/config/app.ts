import env from '#start/env'
import { Secret } from '@adonisjs/core/helpers'
import { defineConfig } from '@adonisjs/core/http'

/**
 * The app key is used for encrypting cookies, generating signed URLs,
 * and by the "encryption" module.
 *
 * The encryption module will fail to decrypt data if the key is lost or
 * changed. Therefore it is recommended to keep the app key secure.
 */
export const appKey = new Secret(env.get('APP_KEY'))

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: false,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    domain: '',
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: false, // TODO: use env for production
    sameSite: 'lax',
  },
})

/**
 * Application configuration
 */
export const application = {
  port: env.get('PORT', 5005),
  proxyPort: env.get('PROXY_PORT', 5006),
  apiKey: env.get('API_KEY', ''),
}

/**
 * Title processing configuration
 */
export const titleProcessing = {
  enableOllamaProcessing: env.get('ENABLE_OLLAMA', process.env.NODE_ENV === 'test' ? false : true),
  useQueuedLlm: env.get('USE_QUEUED_LLM', false), // If true, use queues for LLM processing
  enableQueueProcessing: env.get('ENABLE_QUEUE_PROCESSING', true), // If false, queues are not processed
  llmCacheExpiry: env.get('LLM_CACHE_EXPIRY_SECONDS', 3600), // Default 1 hour
}

/**
 * Indexer cache configuration
 */
export const indexerCache = {
  successTtlSeconds: env.get('INDEXER_CACHE_SUCCESS_TTL_SECONDS', 300), // Default 5 minutes
  errorTtlSeconds: env.get('INDEXER_CACHE_ERROR_TTL_SECONDS', 60), // Default 1 minute
}

/**
 * Stream/heartbeat configuration
 */
export const streamConfig = {
  heartbeatTimeoutMs: env.get('STREAM_HEARTBEAT_TIMEOUT_MS', 60000), // Default 60 seconds
}

/**
 * Ollama AI configuration
 */
const ollamaUrl = env.get('OLLAMA_URL', 'http://localhost:11434')
try {
  new URL(ollamaUrl)
} catch (error) {
  console.error(
    `[Config] Invalid OLLAMA_URL: "${ollamaUrl}". Using default "http://localhost:11434". Error: ${error.message}`
  )
}

export const ollama = {
  url: (() => {
    try {
      new URL(ollamaUrl)
      return ollamaUrl
    } catch {
      return 'http://localhost:11434'
    }
  })(),
  model: env.get('OLLAMA_MODEL', ''),
}
