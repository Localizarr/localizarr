import { test } from '@japa/runner'
import '@japa/api-client/types'
import { createServer, Server } from 'node:http'
import { ProxyService } from '#services/proxy_service'
import app from '@adonisjs/core/services/app'

test.group('Proxy - Basic Functionality', (group) => {
  let testIndexerServer: Server
  let proxyService: ProxyService
  const testIndexerPort = 3001
  const proxyPort = 5008
  const apiKey = 'test-api-key'

  group.setup(async () => {
    // Start test indexer server that simulates therarbg.to and example.com
    testIndexerServer = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/get-posts/order:-a:time:10D:paginate_by:100:format:json')) {
        // Simulate therarbg.to response
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            links: {
              next: 'https://therarbg.to/get-posts/order:-a:time:10D:paginate_by:100:format:json?page=2',
              previous: null,
            },
            page_size: 50,
            count: 50,
            total: 1250,
            results: [
              {
                pk: '837704',
                n: 'Confidence Queen S01E09 720p AMZN WEB DL DDP2 0 H 264 BiOMA EZTV',
                a: 1759594460,
                c: 'TV',
                s: 1414820609,
                t: null,
                u: 'EZTV',
                se: 10,
                le: 13,
                i: 'tt37262316',
                h: '88EA578B09DF558E2B7C437770902BBA615221E3',
                tg: ['English', '720p', 'Specials'],
              },
            ],
          })
        )
      } else if (url.includes('/api?t=search&q=test')) {
        // Simulate example.com XML response
        const mockedXml =
          '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Test Item</title></item></channel></rss>'
        res.writeHead(200, { 'Content-Type': 'application/xml' })
        res.end(mockedXml)
      } else if (url.includes('/api?t=search&q=fail')) {
        // Simulate network error for fail test
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Network error')
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })

    await new Promise<void>((resolve) => {
      testIndexerServer.listen(testIndexerPort, '127.0.0.1', () => {
        resolve()
      })
    })

    // Start proxy service
    proxyService = await app.container.make(ProxyService)
    proxyService.start(proxyPort, apiKey)
  })

  group.each.teardown(() => {
    // No nock cleanup needed since we're not using nock
  })

  group.teardown(async () => {
    // Stop test servers
    if (testIndexerServer) {
      await new Promise<void>((resolve) => {
        testIndexerServer.close(() => resolve())
      })
    }

    if (proxyService) {
      proxyService.stop()
    }
  })

  test('encaminha GET para destino correto', async ({ client }) => {
    const response = await client.get('/_/127.0.0.1:3001/api?t=search&q=test')

    response.assertStatus(200)
    response.assertHeader('content-type', 'application/xml')
    response.assertTextIncludes('<title>Test Item</title>')
  })

  test('erro no backend resulta em erro para cliente', async ({ client }) => {
    const response = await client.get('/_/127.0.0.1:3001/api?t=search&q=fail')

    response.assertStatus(500)
    response.assertTextIncludes('Network error')
  })
})
