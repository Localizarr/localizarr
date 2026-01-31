import router from '@adonisjs/core/services/router'
import ProxyController from '#controllers/proxy_controller'

router.get('/', '#controllers/titles_controller.index')
router.get('/logs', '#controllers/logs_controller.index')
router.post('/logs/:id/replay', '#controllers/logs_controller.replay')

// Proxy route to act like UmlautAdaptarr
router.any('/_/:domain/*', [ProxyController, 'handleProxyRequest'])

// Debug route to force publish a test message to the queue (only for local debugging)
router.get('/__debug/publish-queue', async ({ request, response }) => {
  const { topic, payload } = request.qs()
  try {
    const { QueueService } = await import('#services/queue_service')
    const { QUEUES } = await import('../queues.js')
    const q = QueueService.getInstance()
    await q.ensureStarted()
    await q.publish(
      topic || QUEUES.PROCESS_TITLES_ASYNC,
      payload ? JSON.parse(payload) : { test: 'debug' }
    )
    return response.status(200).send({ ok: true, topic })
  } catch (error) {
    console.error('[DebugRoute] Error publishing to queue:', error)
    return response.status(500).send({ ok: false, error: String(error) })
  }
})

// API routes for titles management
router.post('/test-proxy', [ProxyController, 'testProxy'])

router
  .group(() => {
    router.get('/titles', '#controllers/titles_controller.index')
    router.post('/titles', '#controllers/titles_controller.store')
    router.get('/titles/:id/localized-names', '#controllers/titles_controller.localizedNames')
    router.post('/titles/:id/localized-names', '#controllers/titles_controller.storeLocalizedName')
    router.delete('/titles/:id', '#controllers/titles_controller.destroy')
    router.delete(
      '/titles/:id/localized-names/:localizedNameId',
      '#controllers/titles_controller.destroyLocalizedName'
    )
    router.delete('/titles/clear-all', '#controllers/titles_controller.clearAll')
  })
  .prefix('/api')
