import { assert } from '@japa/assert'
import type { Config } from '@japa/runner/types'
import testUtils from '@adonisjs/core/services/test_utils'
import { apiClient } from '@japa/api-client'

const TEST_HOST = '127.0.0.1'
const TEST_PORT = Number(process.env.TEST_PORT || '3333')

export const plugins: Config['plugins'] = [
  assert(),
  // Disabled: @japa/plugin-adonisjs has compatibility issues with AdonisJS v6
  // The plugin tries to access app.container before it's available
  apiClient({ baseURL: `http://${TEST_HOST}:${TEST_PORT}` }),
]

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    return suite.setup(async () => {
      process.env.HOST = TEST_HOST
      process.env.PORT = String(TEST_PORT)
      // testUtils.db().migrate()
      // testUtils.db().seed()
      const close = await testUtils.httpServer().start()
      return async () => {
        await close()
      }
    })
  }

  // For unit tests, ensure we use in-memory database
  if (suite.name === 'unit') {
    return suite.setup(async () => {
      // Force in-memory database for unit tests
      process.env.DB_CONNECTION = 'memory'
      process.env.NODE_ENV = 'test'
    })
  }
}
