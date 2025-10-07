import { test } from '@japa/runner'
import '@japa/api-client/types'
import { createServer, Server } from 'node:http'
import { ProxyService } from '#services/proxy_service'
import app from '@adonisjs/core/services/app'

test.group('Proxy - Integration Tests', (group) => {
  let testIndexerServer: Server
  let proxyService: ProxyService
  const testIndexerPort = 3001
  const proxyPort = 5008
  const apiKey = 'test-api-key'

  group.setup(async () => {
    // Start test indexer server that simulates therarbg.to
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

  test('teste integrado completo do proxy simulando Prowlarr', async ({ client, assert }) => {
    console.log('Starting integrated proxy test')

    console.log('Using local test server at http://127.0.0.1:3001/get-posts/...')

    // Test the proxy route directly (simulating what the proxy service does)
    const response = await client.get(
      '/_/127.0.0.1:3001/get-posts/order:-a:time:10D:paginate_by:100:format:json'
    )

    console.log(`Route response status: ${response.status()}`)

    // Verify the response
    response.assertStatus(200)
    response.assertHeader('content-type', 'application/json')

    const jsonResponse = response.body()
    assert.equal(jsonResponse.page_size, 50)
    assert.equal(jsonResponse.count, 50)
    assert.equal(jsonResponse.total, 1250)
    assert.isArray(jsonResponse.results)
    assert.equal(jsonResponse.results.length, 1)
    assert.equal(jsonResponse.results[0].pk, '837704')
    assert.equal(jsonResponse.results[0].c, 'TV')

    console.log('Test completed successfully')
  })
})
