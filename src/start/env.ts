/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  APP_NAME: Env.schema.string.optional(),
  LOG_LEVEL: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  PORT: Env.schema.number.optional(),
  APP_KEY: Env.schema.string(),
  PROXY_PORT: Env.schema.number(),
  API_KEY: Env.schema.string.optional(),
  DB_CONNECTION: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Ollama AI Processing Configuration
  |----------------------------------------------------------
  */
  ENABLE_OLLAMA_PROCESSING: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
})
