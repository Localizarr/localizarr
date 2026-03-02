/**
 * Unit tests for QueueService
 *
 * The queue uses the filesystem (tmp/queues) as the transport layer.
 * Tests use a custom temp directory so they do not pollute the real queue.
 * No Ollama or database calls are made — subscriber callbacks are simple stubs.
 */

import { test } from '@japa/runner'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { QueueService } from '#services/queue_service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh QueueService that writes to an isolated temp directory.
 * We reach into the private constructor via `Object.create` so the singleton
 * pattern is bypassed for test isolation.
 */
function createQueue(dir: string): QueueService {
  // Bypass private constructor + singleton
  const instance = Object.create(QueueService.prototype) as any
  instance['subscribers'] = new Map()
  instance['intervalId'] = null
  instance['processing'] = false
  instance['pollingLimit'] = 1
  instance['queueDir'] = dir
  return instance as QueueService
}

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'localizarr-queue-test-'))
}

async function listPendingFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir)
  return files.filter((f) => f.includes('pending') && f.endsWith('.json'))
}

async function listFinishedFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir)
  return files.filter((f) => f.includes('finished') && f.endsWith('.json'))
}

async function listFailedFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir)
  return files.filter((f) => f.includes('failed') && f.endsWith('.json'))
}

// ─── publish ──────────────────────────────────────────────────────────────────

test.group('QueueService.publish', (group) => {
  let tmpDir: string
  let queue: QueueService

  group.each.setup(async () => {
    tmpDir = await makeTmpDir()
    queue = createQueue(tmpDir)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  group.each.teardown(async () => {
    queue.stop()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('creates a pending JSON file in the queue directory', async ({ assert }) => {
    const topic = 'test-topic'
    const payload = { foo: 'bar', num: 42 }

    await queue.publish(topic, payload)

    const files = await listPendingFiles(tmpDir)
    assert.lengthOf(files, 1)
    assert.include(files[0], topic)

    const content = JSON.parse(await fs.readFile(path.join(tmpDir, files[0]), 'utf-8'))
    assert.deepEqual(content, payload)
  })

  test('creates separate files for multiple publications', async ({ assert }) => {
    await queue.publish('topic-a', { id: 1 })
    await queue.publish('topic-a', { id: 2 })
    await queue.publish('topic-b', { id: 3 })

    const files = await listPendingFiles(tmpDir)
    assert.lengthOf(files, 3)
  })

  test('includes topic name in the filename', async ({ assert }) => {
    await queue.publish('my-special-topic', { data: true })

    const files = await listPendingFiles(tmpDir)
    assert.isTrue(files.some((f) => f.startsWith('my-special-topic-')))
  })

  test('stores complex nested payloads correctly', async ({ assert }) => {
    const payload = {
      nested: { a: 1, b: [1, 2, 3] },
      nullValue: null,
      bool: true,
    }

    await queue.publish('test-topic', payload)

    const files = await listPendingFiles(tmpDir)
    const content = JSON.parse(await fs.readFile(path.join(tmpDir, files[0]), 'utf-8'))
    assert.deepEqual(content, payload)
  })
})

// ─── subscribe + processQueues ────────────────────────────────────────────────

test.group('QueueService.subscribe and processQueues', (group) => {
  let tmpDir: string
  let queue: QueueService

  group.each.setup(async () => {
    tmpDir = await makeTmpDir()
    queue = createQueue(tmpDir)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  group.each.teardown(async () => {
    queue.stop()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('subscriber callback is invoked with the correct data', async ({ assert }) => {
    let receivedData: any = null

    queue.subscribe('test-topic', async (finish, data) => {
      receivedData = data
      await finish()
    })

    const payload = { message: 'hello' }
    await queue.publish('test-topic', payload)

    // Manually trigger queue processing (bypass interval)
    await (queue as any).processQueues()

    assert.deepEqual(receivedData, payload)
  })

  test('file is renamed to finished after successful processing', async ({ assert }) => {
    queue.subscribe('done-topic', async (finish, _data) => {
      await finish()
    })

    await queue.publish('done-topic', { x: 1 })
    await (queue as any).processQueues()

    const pending = await listPendingFiles(tmpDir)
    const finished = await listFinishedFiles(tmpDir)

    assert.lengthOf(pending, 0)
    assert.lengthOf(finished, 1)
  })

  test('file is renamed to failed when subscriber throws', async ({ assert }) => {
    queue.subscribe('bad-topic', async (_finish, _data) => {
      throw new Error('Subscriber error')
    })

    await queue.publish('bad-topic', { x: 1 })
    await (queue as any).processQueues()

    const pending = await listPendingFiles(tmpDir)
    const failed = await listFailedFiles(tmpDir)

    assert.lengthOf(pending, 0)
    assert.lengthOf(failed, 1)
  })

  test('messages for topics with no subscriber are skipped (stay pending)', async ({ assert }) => {
    await queue.publish('unregistered-topic', { data: 'ignored' })
    await (queue as any).processQueues()

    const pending = await listPendingFiles(tmpDir)
    // The file should remain pending because there is no subscriber
    assert.lengthOf(pending, 1)
  })

  test('only pollingLimit messages are processed per cycle', async ({ assert }) => {
    let processedCount = 0

    queue.subscribe('limited-topic', async (finish, _data) => {
      processedCount++
      await finish()
    })

    // Publish 3 messages; pollingLimit = 1
    await queue.publish('limited-topic', { n: 1 })
    await queue.publish('limited-topic', { n: 2 })
    await queue.publish('limited-topic', { n: 3 })

    await (queue as any).processQueues()

    // Only 1 should have been consumed
    assert.equal(processedCount, 1)

    const pending = await listPendingFiles(tmpDir)
    assert.lengthOf(pending, 2)
  })

  test('second processQueues run processes the next message', async ({ assert }) => {
    let processedCount = 0

    queue.subscribe('seq-topic', async (finish, _data) => {
      processedCount++
      await finish()
    })

    await queue.publish('seq-topic', { n: 1 })
    await queue.publish('seq-topic', { n: 2 })

    await (queue as any).processQueues()
    assert.equal(processedCount, 1)

    await (queue as any).processQueues()
    assert.equal(processedCount, 2)
  })

  test('subscriber receives the full data object from the file', async ({ assert }) => {
    const expected = { imdbId: 'tt14144906', lang: 'pt-BR', nested: { a: true } }
    let received: any = null

    queue.subscribe('data-topic', async (finish, data) => {
      received = data
      await finish()
    })

    await queue.publish('data-topic', expected)
    await (queue as any).processQueues()

    assert.deepEqual(received, expected)
  })
})

// ─── start / stop ─────────────────────────────────────────────────────────────

test.group('QueueService.start and stop', (group) => {
  let tmpDir: string
  let queue: QueueService

  group.each.setup(async () => {
    tmpDir = await makeTmpDir()
    queue = createQueue(tmpDir)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  group.each.teardown(async () => {
    queue.stop()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('start sets up an interval and stop clears it', async ({ assert }) => {
    await queue.start()
    assert.isNotNull((queue as any).intervalId)

    queue.stop()
    assert.isNull((queue as any).intervalId)
  })

  test('calling stop on an already-stopped queue is a no-op', ({ assert }) => {
    // Should not throw
    assert.doesNotThrow(() => queue.stop())
    assert.isNull((queue as any).intervalId)
  })

  test('calling start twice does not create a second interval', async ({ assert }) => {
    await queue.start()
    const firstId = (queue as any).intervalId

    await queue.start()
    const secondId = (queue as any).intervalId

    assert.strictEqual(firstId, secondId)
    queue.stop()
  })
})

// ─── ensureStarted ────────────────────────────────────────────────────────────

test.group('QueueService.ensureStarted', (group) => {
  let tmpDir: string
  let queue: QueueService

  group.each.setup(async () => {
    tmpDir = await makeTmpDir()
    queue = createQueue(tmpDir)
    await fs.mkdir(tmpDir, { recursive: true })
  })

  group.each.teardown(async () => {
    queue.stop()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('starts the queue if not already running', async ({ assert }) => {
    assert.isNull((queue as any).intervalId)

    await queue.ensureStarted()

    assert.isNotNull((queue as any).intervalId)
  })

  test('calling ensureStarted on an already-running queue is a no-op', async ({ assert }) => {
    await queue.ensureStarted()
    const firstId = (queue as any).intervalId

    await queue.ensureStarted()
    const secondId = (queue as any).intervalId

    assert.strictEqual(firstId, secondId)
  })
})
