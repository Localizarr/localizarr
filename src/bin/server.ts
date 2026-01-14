/*
|--------------------------------------------------------------------------
| HTTP server entrypoint
|--------------------------------------------------------------------------
|
| The "server.ts" file is the entrypoint for starting the AdonisJS HTTP
| server. Either you can run this file directly or use the "serve"
| command to run this file and monitor file changes
|
*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { execSync } from 'node:child_process'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')

      // Run database migrations before starting the server
      console.log('Running database migrations...')
      try {
        execSync('node ace migration:run --force', {
          stdio: 'inherit',
          cwd: APP_ROOT.pathname,
        })
        console.log('Database migrations completed successfully')
      } catch (error) {
        console.error('Failed to run database migrations:', error)
        throw error
      }

      // Check Ollama connectivity if enabled
      const { titleProcessing } = await import('#config/app')
      if (titleProcessing.enableOllamaProcessing) {
        const { OllamaService } = await import('#services/ollama_service')
        try {
          const models = await OllamaService.checkAvailableModels()
          if (!models) {
            console.error('[Startup] Ollama models could not be listed; disabling LLM processing')
            ;(titleProcessing as any).enableOllamaProcessing = false
          }
        } catch (err) {
          console.error('[Startup] Error during Ollama check:', err)
          ;(titleProcessing as any).enableOllamaProcessing = false
        }
      }
      // Queue processing is now initialized lazily in the controller
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .httpServer()
  .start()
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
