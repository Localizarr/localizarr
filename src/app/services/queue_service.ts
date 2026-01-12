import { titleProcessing } from '#config/app'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TitlesService } from '../repositories/titles_service.js'
import { QUEUES } from '../../queues.js'

export class QueueService {
  private static instance: QueueService
  private subscribers: Map<string, (finish: () => Promise<void>, data: any) => Promise<void>> = new Map()
  private intervalId: NodeJS.Timeout | null = null
  private processing = false
  private pollingLimit = 1
  private queueDir = 'tmp/queues'

  private constructor() {
    this.ensureQueueDir()
  }

  private async ensureQueueDir() {
    try {
      await fs.mkdir(this.queueDir, { recursive: true })
    } catch (error) {
      console.error('[QueueService] Error creating queue directory:', error)
    }
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService()
    }
    return QueueService.instance
  }

  /**
   * Ensure the service has the processing loop started. Safe to call multiple times.
   */
  public async ensureStarted(): Promise<void> {
    if (!this.intervalId) {
      await this.start()

      // Initialize consumers after starting the service
      this.initializeConsumers()
    }
  }

  private initializeConsumers(): void {
    // Consumer for async title processing
    this.subscribe(QUEUES.PROCESS_TITLES_ASYNC, async (finish, data) => {
      try {
        console.log('[Consumer] Processing titles asynchronously:', data)

        const { responseData, imdbId, executionLogId } = data

        // Fetch execution log if ID provided
        let executionLog: any = null
        if (executionLogId) {
          console.log(`[Consumer] Fetching execution log with ID: ${executionLogId}`)
          try {
            const ExecutionLog = (await import('#models/execution_log')).default
            executionLog = await ExecutionLog.find(executionLogId)
            if (executionLog) {
              console.log(`[Consumer] Successfully found execution log: ${executionLogId}`)
            } else {
              console.warn(`[Consumer] Execution log NOT FOUND in database for ID: ${executionLogId}`)
            }
          } catch (e) {
            console.error(`[Consumer] Failed to fetch execution log ${executionLogId}`, e)
          }
        } else {
          console.warn('[Consumer] No executionLogId provided in queue data')
        }

        // Extract titles from response data
        const titles = TitlesService.extractTitlesFromResponse(responseData)
        console.log(`[Consumer] Extracted ${titles.length} titles from response data`)

        const startTimeConsumer = Date.now()
        if (titles.length > 0) {
          console.log('[Consumer] Titles extracted:', titles)

          // Process with LLM and store results
          console.log('[Consumer] Starting LLM processing and storage...')
          await TitlesService.processSearchResultsWithLLM(responseData, 'pt-BR', imdbId, executionLog)
          console.log('[Consumer] LLM processing and storage completed')

          // Apply the stored replacements
          await TitlesService.applyDatabaseTitleReplacements(responseData, 'pt-BR')
          console.log('[Consumer] Database title replacements applied')
        } else {
          console.log('[Consumer] No titles found in response data')
        }

        // Finalize log if present
        if (executionLog) {
          try {
            const bodyStr = typeof responseData === 'object' ? JSON.stringify(responseData) : String(responseData)
            executionLog.processedResponseBody = bodyStr.length > 50000 ? bodyStr.substring(0, 50000) + '...[TRUNCATED]' : bodyStr
            executionLog.status = 'completed'
            executionLog.durationMs = (executionLog.durationMs || 0) + (Date.now() - startTimeConsumer)
            await executionLog.save()
            console.log(`[Consumer] Finalized execution log ${executionLogId}`)
          } catch (e) {
            console.error(`[Consumer] Failed to finalize execution log ${executionLogId}`, e)
          }
        }

        await finish()
        console.log('[Consumer] Finished processing PROCESS_TITLES_ASYNC')
      } catch (error) {
        console.error('[Consumer] Error in async title processing:', error)
        throw error
      }
    })

    // Consumer for processing search responses with LLM
    this.subscribe(QUEUES.PROCESS_RESPONSE_WITH_OLLAMA, async (finish, data) => {
      try {
        console.log('[Consumer] Processing response with LLM:', data)

        // Simple test consumer - just finish immediately
        console.log('[Consumer] Test LLM consumer finishing immediately')
        await finish()
        console.log('[Consumer] Finished processing PROCESS_RESPONSE_WITH_OLLAMA')
      } catch (error) {
        console.error('[Consumer] Error processing response:', error)
        throw error
      }
    })

    console.log('[Consumers] Initialized test queue consumers')
  }

  public subscribe(topic: string, callback: (finish: () => Promise<void>, data: any) => Promise<void>): void {
    this.subscribers.set(topic, callback)
    console.log(`[QueueService] Subscribed to topic: ${topic}`)
  }

  public async publish(topic: string, data: any): Promise<void> {
    console.log(`[QueueService] Publishing to topic: ${topic}, data:`, data)
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-pending.json`
      const filePath = path.join(this.queueDir, `${topic}-${fileName}`)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
      console.log(`[QueueService] Successfully wrote pending queue message to ${filePath}`)
    } catch (error) {
      console.error(`[QueueService] Error writing queue message for ${topic}:`, error)
      throw error
    }
  }

  public async start(): Promise<void> {
    if (this.intervalId) {
      console.warn('[QueueService] Already started')
      return
    }

    console.log('[QueueService] Starting queue processing with 5s interval')
    this.intervalId = setInterval(() => {
      this.processQueues()
    }, 5000)

    console.log('[QueueService] Started processing queues every 5s')
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[QueueService] Stopped processing queues')
    }
  }

  private async processQueues(): Promise<void> {
    if (this.processing) {
      return
    }
    this.processing = true

    try {
      // Check if queue processing is enabled
      if (!titleProcessing.enableQueueProcessing) {
        console.log('[QueueService] Queue processing disabled via configuration')
        return
      }

      console.log('[QueueService] Queue processing is ENABLED')

      // Get all pending queue files
      const files = await fs.readdir(this.queueDir)
      console.log(`[QueueService] All files in queue dir: ${files.join(', ')}`)

      const queueFiles = files.filter(f => {
        const hasPending = f.includes('pending')
        const endsWithJson = f.endsWith('.json')
        const noFinished = !f.includes('finished')
        const noFailed = !f.includes('failed')
        const matches = hasPending && endsWithJson && noFinished && noFailed
        console.log(`[QueueService] File ${f}: hasPending=${hasPending}, endsWithJson=${endsWithJson}, noFinished=${noFinished}, noFailed=${noFailed}, matches=${matches}`)
        return matches
      }).slice(0, this.pollingLimit)

      console.log(`[QueueService] Filter check for each file:`)
      files.forEach(f => {
        const hasPending = f.includes('pending')
        const endsWithJson = f.endsWith('.json')
        const noFinished = !f.includes('finished')
        const noFailed = !f.includes('failed')
        const matches = hasPending && endsWithJson && noFinished && noFailed
        if (!matches) {
          console.log(`  ${f}: hasPending=${hasPending}, endsWithJson=${endsWithJson}, noFinished=${noFinished}, noFailed=${noFailed}, matches=${matches}`)
        }
      })

      console.log(`[QueueService] Found ${queueFiles.length} pending queue files: ${queueFiles.join(', ')}`)

      console.log(`[QueueService] About to process ${queueFiles.length} files`)
      for (const file of queueFiles) {
        console.log(`[QueueService] Starting to process file: ${file}`)
        const filePath = path.join(this.queueDir, file)

        // Parse filename: topic-timestamp-randomId-pending.json
        // Find the last occurrence of -pending to split correctly
        const pendingIndex = file.lastIndexOf('-pending')
        console.log(`[QueueService] Processing file: ${file}, pendingIndex: ${pendingIndex}`)
        if (pendingIndex === -1) {
          console.log(`[QueueService] No -pending found in ${file}, skipping`)
          continue
        }

        const topicWithId = file.substring(0, pendingIndex) // Everything before -pending
        console.log(`[QueueService] topicWithId: ${topicWithId}`)

        // Now split topicWithId by '-' to separate topic, timestamp, randomId
        // The topic can contain '-', so we need to find the last two parts as timestamp and randomId
        const parts = topicWithId.split('-')
        console.log(`[QueueService] parts: ${parts}, parts.length: ${parts.length}`)
        if (parts.length < 3) { // topic + timestamp + randomId minimum
          console.log(`[QueueService] Not enough parts in topicWithId for ${file}, skipping`)
          continue
        }

        // Assume last two parts are timestamp and randomId, everything before is topic
        const randomId = parts[parts.length - 1]
        const timestamp = parts[parts.length - 2]
        const topic = parts.slice(0, -2).join('-')

        console.log(`[QueueService] Parsed - topic: ${topic}, timestamp: ${timestamp}, randomId: ${randomId}`)

        console.log(`[QueueService] Processing file: ${file}, topic: ${topic}`)

        const callback = this.subscribers.get(topic)
        console.log(`[QueueService] File ${file} topic=${topic} hasCallback=${!!callback}`)
        if (!callback) {
          console.warn(`[QueueService] No subscriber for topic: ${topic}, skipping ${file}`)
          continue
        }

        try {
          const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
          console.log(`[QueueService] Read data from ${file}:`, data)

          const finish = async () => {
            // Rename file from pending to finished
            const finishedFileName = `${topic}-${timestamp}-${randomId}-finished.json`
            const finishedFilePath = path.join(this.queueDir, finishedFileName)
            console.log(`[QueueService] Renaming ${file} to ${finishedFileName}`)
            await fs.rename(filePath, finishedFilePath)
            console.log(`[QueueService] Successfully renamed processed file ${file} to ${finishedFileName}`)
          }

          console.log(`[QueueService] Calling callback for ${file}`)
          await callback(finish, data)
          console.log(`[QueueService] Callback completed for ${file}`)
        } catch (err) {
          console.error(`[QueueService] Error processing file ${file}:`, err)
          // Rename to failed state for debugging (optional)
          try {
            const failedFileName = `${topic}-${timestamp}-${randomId}-failed.json`
            const failedFilePath = path.join(this.queueDir, failedFileName)
            await fs.rename(filePath, failedFilePath)
            console.log(`[QueueService] Renamed failed file ${file} to ${failedFileName}`)
          } catch (renameErr) {
            console.error(`[QueueService] Error renaming failed file ${file}:`, renameErr)
            // Remove corrupted files if rename fails
            try {
              await fs.unlink(filePath)
            } catch (unlinkErr) {
              console.error(`[QueueService] Error removing corrupted file ${file}:`, unlinkErr)
            }
          }
        }
      }
    } catch (error) {
      console.error('[QueueService] Error reading queue files:', error)
    } finally {
      this.processing = false
      console.log('[QueueService] Finished queue processing cycle')
    }
  }
}
