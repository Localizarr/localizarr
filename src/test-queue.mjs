import { QueueService } from './app/services/queue_service.js'

async function test() {
  console.log('Starting queue service...')
  const q = QueueService.getInstance()
  await q.ensureStarted()

  console.log('Publishing message...')
  await q.publish('process-titles-async', {
    responseData: {
      streams: [
        { title: 'Test Movie 2024' },
        { title: 'Another Test Film' }
      ],
      cacheMaxAge: 3600,
      staleRevalidate: 14400,
      staleError: 604800
    },
    imdbId: 'tt13146488'
  })

  console.log('Waiting 1 second for processing...')
  await new Promise(resolve => setTimeout(resolve, 1000))

  console.log('Checking files...')
  const fs = await import('fs/promises')
  try {
    const files = await fs.readdir('tmp/queues')
    console.log('Final files:', files)
  } catch (error) {
    console.error('Error reading queue dir:', error)
  }
}

test().catch(console.error)
