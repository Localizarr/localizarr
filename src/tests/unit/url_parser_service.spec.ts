import { test } from '@japa/runner'
import { UrlParserService } from '../../app/services/url_parser_service.js'

test.group('UrlParserService', () => {
  test('parseTorrentioUrl parses series URL', ({ assert }) => {
    const path = '/stream/series/tt13146488:2:7.json'
    const result = UrlParserService.parseTorrentioUrl(path)
    assert.deepEqual(result, {
      titleId: '13146488',
      season: 2,
      episode: 7,
      mediaType: 'tv'
    })
  })

  test('parseTorrentioUrl parses movie URL', ({ assert }) => {
    const path = '/stream/movie/tt0111161.json'
    const result = UrlParserService.parseTorrentioUrl(path)
    assert.deepEqual(result, {
      titleId: '0111161',
      mediaType: 'movie'
    })
  })

  test('parseTorrentioUrl returns empty for invalid URL', ({ assert }) => {
    const path = '/stream/unknown/tt9999999.json'
    const result = UrlParserService.parseTorrentioUrl(path)
    assert.deepEqual(result, {})
  })
})
