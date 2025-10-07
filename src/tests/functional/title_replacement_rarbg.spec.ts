import { test } from '@japa/runner'
import '@japa/api-client/types'
import { createServer, Server } from 'node:http'
import { ProxyService } from '#services/proxy_service'
import app from '@adonisjs/core/services/app'

test.group('Title Replacement - RARBG Format', (group) => {
  let testIndexerServer: Server
  let proxyService: ProxyService
  const testIndexerPort = 3001
  const proxyPort = 5006
  const apiKey = 'test-api-key'

  group.setup(async () => {
    // Start test indexer server that simulates RARBG with title replacement payload
    testIndexerServer = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/rarbg-payload')) {
        // Simulate RARBG response with Pacificador title for middleware testing
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            links: {
              next: 'https://therarbg.to/get-posts/order:-a:keywords:PeaceMaker:paginate_by:100:format:json/?page=2',
              previous: null,
            },
            page_size: 50,
            count: 50,
            total: 726,
            results: [
              {
                pk: '8368b8',
                n: 'Peacemaker 2022 S02E06 Ignorance Is Chris 1080p AMZN WEB DL DDP5',
                a: 1759590024,
                c: 'TV',
                s: 2684354560,
                t: null,
                u: 'eXpOrTeRICV',
                se: 34,
                le: 23,
                i: null,
                h: '2C7F988CAD31A4A04A5D1FB1919E7E31E1CFE9BE',
                tg: ['1080p', 'Specials'],
              },
              {
                pk: '836f85',
                n: 'Pacificador S02E07 Like a Keith in the Night 2160p MAX WEB-DL DDP5 1 DV HEVC',
                a: 1759517408,
                c: 'TV',
                s: 4013731990,
                t: null,
                u: 'TvTeam',
                se: 70,
                le: 80,
                i: null,
                h: 'F63A628DC82B3DA49552F37628ABFF163A9350B5',
                tg: ['4K', 'Specials'],
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

  test('middleware substitui títulos corretamente - RARBG com results', async ({
    client,
    assert,
  }) => {
    console.log('Starting RARBG title replacement middleware test')

    // Test the proxy route that returns RARBG-like payload with "Pacificador"
    const response = await client.get('/_/127.0.0.1:3001/rarbg-payload')

    console.log(`Route response status: ${response.status()}`)

    // Verify the response
    response.assertStatus(200)
    response.assertHeader('content-type', 'application/json')

    const jsonResponse = response.body()
    assert.equal(jsonResponse.page_size, 50)
    assert.equal(jsonResponse.count, 50)
    assert.equal(jsonResponse.total, 726)
    assert.isArray(jsonResponse.results)
    assert.equal(jsonResponse.results.length, 2)

    // Verify that "Pacificador" was replaced with "Peacemaker"
    const pacificadorItem = jsonResponse.results.find((item: any) => item.pk === '836f85')
    assert.isDefined(pacificadorItem, 'Item com pk 836f85 deve existir')
    assert.equal(
      pacificadorItem.n,
      'Peacemaker S02E07 Like a Keith in the Night 2160p MAX WEB-DL DDP5 1 DV HEVC',
      'Título Pacificador deve ter sido substituído para Peacemaker'
    )

    // Verify that "Peacemaker" remains "Peacemaker" (already correct)
    const peacemakerItem = jsonResponse.results.find((item: any) => item.pk === '8368b8')
    assert.isDefined(peacemakerItem, 'Item com pk 8368b8 deve existir')
    assert.equal(
      peacemakerItem.n,
      'Peacemaker 2022 S02E06 Ignorance Is Chris 1080p AMZN WEB DL DDP5',
      'Título Peacemaker deve permanecer inalterado pois já está correto'
    )

    console.log('RARBG title replacement middleware test completed successfully')
  })
})
