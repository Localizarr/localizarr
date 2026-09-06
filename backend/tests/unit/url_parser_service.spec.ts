/**
 * Unit tests for UrlParserService
 */

import { test } from '@japa/runner'
import { UrlParserService } from '#services/url_parser_service'

test.group('UrlParserService - parseTorrentioUrl', () => {
  test('parses series URL with season and episode', ({ assert }) => {
    const result = UrlParserService.parseTorrentioUrl('/stream/series/tt13146488:2:7.json')
    assert.deepEqual(result, {
      titleId: '13146488',
      season: 2,
      episode: 7,
      mediaType: 'tv'
    })
  })

  test('parses movie URL', ({ assert }) => {
    const result = UrlParserService.parseTorrentioUrl('/stream/movie/tt0111161.json')
    assert.deepEqual(result, {
      titleId: '0111161',
      mediaType: 'movie'
    })
  })

  test('returns empty object for non-matching URL', ({ assert }) => {
    const result = UrlParserService.parseTorrentioUrl('/api/other')
    assert.deepEqual(result, {})
  })
})

test.group('UrlParserService - extractParams', () => {
  test('extracts params from torrentio domain', ({ assert }) => {
    const result = UrlParserService.extractParams('torrentio.strem.fun', '/stream/series/tt1234567:1:5.json', {})
    assert.equal(result.titleId, '1234567')
    assert.equal(result.season, 1)
    assert.equal(result.episode, 5)
    assert.equal(result.mediaType, 'tv')
  })

  test('extracts params from strem.fun domain', ({ assert }) => {
    const result = UrlParserService.extractParams('strem.fun', '/stream/movie/tt9999999.json', {})
    assert.equal(result.titleId, '9999999')
    assert.equal(result.mediaType, 'movie')
  })

  test('falls back to torrentio parsing for unknown domain', ({ assert }) => {
    const result = UrlParserService.extractParams('unknown.com', '/stream/series/tt1111111:3:2.json', {})
    assert.equal(result.titleId, '1111111')
    assert.equal(result.mediaType, 'tv')
  })
})

test.group('UrlParserService - extractImdbId', () => {
  test('extracts IMDb ID from path', ({ assert }) => {
    const result = UrlParserService.extractImdbId('/stream/series/tt12345678:1:1.json')
    assert.equal(result, 'tt12345678')
  })

  test('returns undefined when no IMDb ID present', ({ assert }) => {
    const result = UrlParserService.extractImdbId('/api/other/path')
    assert.isUndefined(result)
  })
})

test.group('UrlParserService - isValidProxyUrl', () => {
  test('returns true for valid https URL', ({ assert }) => {
    const result = UrlParserService.isValidProxyUrl('https://indexer.com/api')
    assert.isTrue(result)
  })

  test('returns true for valid http URL', ({ assert }) => {
    const result = UrlParserService.isValidProxyUrl('http://indexer.com/api')
    assert.isTrue(result)
  })

  test('returns false for invalid protocol', ({ assert }) => {
    const result = UrlParserService.isValidProxyUrl('ftp://indexer.com/api')
    assert.isFalse(result)
  })

  test('returns false for malformed URL', ({ assert }) => {
    const result = UrlParserService.isValidProxyUrl('not-a-url')
    assert.isFalse(result)
  })
})

test.group('UrlParserService - buildProxyUrl', () => {
  test('builds URL with query params', async ({ assert }) => {
    const url = await UrlParserService.buildProxyUrl('indexer.com', '/api/search', { q: 'test' })
    assert.isTrue(url.includes('q=test'))
  })

  test('builds URL without query params', async ({ assert }) => {
    const url = await UrlParserService.buildProxyUrl('indexer.com', '/api/status', {})
    assert.isTrue(url.endsWith('/api/status'))
  })
})
