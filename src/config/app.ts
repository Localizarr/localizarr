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
  enableOllamaProcessing: env.get('ENABLE_OLLAMA_PROCESSING', true),
}

/**
 * Ollama AI configuration
 */
export const ollama = {
  host: env.get('OLLAMA_HOST', 'host.docker.internal'),
  port: env.get('OLLAMA_PORT', '11434'),
  model: env.get('OLLAMA_MODEL', 'gemma3:4b'),
}
