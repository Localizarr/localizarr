import { test } from '@japa/runner'
import '@japa/api-client/types'
import { createServer, Server } from 'node:http'
import { ProxyService } from '#services/proxy_service'
import app from '@adonisjs/core/services/app'

test.group('URL Parameter Extraction', (group) => {
  let testIndexerServer: Server
  let proxyService: ProxyService
  const testIndexerPort = 3001
  const proxyPort = 5006
  const apiKey = 'test-api-key'

  group.setup(async () => {
    // Start test indexer server that simulates Torrentio
    testIndexerServer = createServer((req, res) => {
      const url = req.url || ''

      if (url.includes('/stream/series/tt14144906:2:7.json')) {
        // Simulate Torrentio response for Peacemaker S02E07 with localized title
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            streams: [
              {
                name: 'Torrentio\n1080p',
                title:
                  'Pacificador.S02E07.1080p.x264.WEB-DL.DUAL.5.1-SF\n👤 66 💾 978.11 MB ⚙️ Comando\nDual Audio / 🇬🇧 / 🇵🇹',
                infoHash: '9a997bb1b1b006cbf97957643d2e408f1052edc6',
                fileIdx: 0,
                behaviorHints: {
                  bingeGroup: 'torrentio|1080p|SF',
                  filename: 'Pacificador.S02E07.1080p.x264.WEB-DL.DUAL.5.1-SF.mkv',
                },
              },
            ],
            cacheMaxAge: 3600,
            staleRevalidate: 14400,
            staleError: 604800,
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

  test('substitui corretamente título localizado pelo título original', async ({
    client,
    assert,
  }) => {
    console.log('Starting localized to original title replacement test')

    // Test the proxy route with Torrentio-style URL
    const response = await client.get('/_/127.0.0.1:3001/stream/series/tt14144906:2:7.json')

    console.log(`Route response status: ${response.status()}`)

    // Verify the response
    response.assertStatus(200)
    response.assertHeader('content-type', 'application/json')

    const jsonResponse = response.body()
    assert.isArray(jsonResponse.streams)
    assert.equal(jsonResponse.streams.length, 1)

    const stream = jsonResponse.streams[0]
    assert.equal(stream.name, 'Torrentio\n1080p')

    // Verify that "Pacificador" was replaced with "Peacemaker" in the title
    assert.equal(
      stream.title,
      'Peacemaker.S02E07.1080p.x264.WEB-DL.DUAL.5.1-SF\n👤 66 💾 978.11 MB ⚙️ Comando\nDual Audio / 🇬🇧 / 🇵🇹',
      'Título Pacificador deve ter sido substituído para Peacemaker'
    )

    // Verify that filename in behaviorHints was also replaced
    assert.equal(
      stream.behaviorHints.filename,
      'Peacemaker.S02E07.1080p.x264.WEB-DL.DUAL.5.1-SF.mkv',
      'Filename deve ter sido substituído para Peacemaker'
    )

    console.log('Localized to original title replacement test completed successfully')
  })

  test('valida extração de parâmetros da URL Torrentio tt13146488:2:7', async ({ assert }) => {
    console.log('Testing URL parameter extraction directly')

    const { UrlParserService } = await import('#services/url_parser_service')

    // Test the URL parsing directly
    const params = UrlParserService.extractParams(
      'torrentio.strem.fun',
      '/stream/series/tt14144906:2:7.json',
      {}
    )

    console.log('Extracted params:', params)

    // Verify the extracted parameters
    assert.equal(params.titleId, '14144906', 'Title ID deve ser 14144906')
    assert.equal(params.season, 2, 'Season deve ser 2')
    assert.equal(params.episode, 7, 'Episode deve ser 7')
    assert.equal(params.mediaType, 'tv', 'Media type deve ser tv')

    console.log('URL parameter extraction validation completed successfully')
  })
})
