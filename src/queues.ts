// Queue topics constants
export const QUEUES = {
  PROCESS_RESPONSE_WITH_OLLAMA: 'process-response-with-ollama',
  PROCESS_TITLES_ASYNC: 'process-titles-async',
} as const

export type QueueTopic = typeof QUEUES[keyof typeof QUEUES]
