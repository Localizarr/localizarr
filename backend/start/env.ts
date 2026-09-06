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
  ENABLE_OLLAMA: Env.schema.boolean.optional(),
  USE_QUEUED_LLM: Env.schema.boolean.optional(),
  ENABLE_QUEUE_PROCESSING: Env.schema.boolean.optional(),
  // minimum interval between LLM calls for the same URL in seconds
  LLM_CACHE_EXPIRY_SECONDS: Env.schema.number.optional(),

  OLLAMA_URL: Env.schema.string.optional(),
  OLLAMA_MODEL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Indexer Cache Configuration
  |----------------------------------------------------------
  */
  INDEXER_CACHE_SUCCESS_TTL_SECONDS: Env.schema.number.optional(),
  INDEXER_CACHE_ERROR_TTL_SECONDS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Stream/Heartbeat Configuration
  |----------------------------------------------------------
  */
  STREAM_HEARTBEAT_TIMEOUT_MS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
})
