import { test } from '@japa/runner'
import { OllamaService } from '#services/ollama_service'

test.group('TheTVDB Service', (group) => {
  group.each.teardown(async () => {
    // Clean up any cached data if needed
  })

  test('should fetch title information from TheTVDB', async ({ assert }) => {
    console.log('Testing TheTVDB service with Peacemaker (tt14144906)')

    // Test with Peacemaker IMDb ID
    const titleInfo = await OllamaService.getTitleInfo('tt14144906')

    console.log('Title info result:', titleInfo)

    // Verify the response structure
    assert.isNotNull(titleInfo)
    assert.equal(titleInfo?.imdbId, 'tt14144906')
    assert.isString(titleInfo?.originalTitle)
    assert.isObject(titleInfo?.availableLanguages)
    assert.isDefined(titleInfo?.lastUpdated)

    // Should have at least English
    assert.isDefined(titleInfo?.availableLanguages['en'])

    console.log('TheTVDB service test completed successfully')
  }).timeout(30000) // 30 second timeout for external API call

  test('should return cached data on subsequent calls', async ({ assert }) => {
    console.log('Testing TheTVDB service caching')

    // First call should fetch from TheTVDB
    const firstCall = await OllamaService.getTitleInfo('tt14144906')
    assert.isNotNull(firstCall)

    // Second call should use cache
    const secondCall = await OllamaService.getTitleInfo('tt14144906')
    assert.isNotNull(secondCall)

    // Should be the same data
    assert.equal(firstCall?.imdbId, secondCall?.imdbId)
    assert.equal(firstCall?.originalTitle, secondCall?.originalTitle)

    console.log('TheTVDB service caching test completed successfully')
  }).timeout(30000)

  test('should handle non-existent IMDb ID gracefully', async ({ assert }) => {
    console.log('Testing TheTVDB service with invalid IMDb ID')

    // Test with a non-existent IMDb ID
    const titleInfo = await OllamaService.getTitleInfo('tt99999999')

    // Should return null for non-existent titles
    assert.isNull(titleInfo)

    console.log('TheTVDB service invalid ID test completed successfully')
  }).timeout(30000)
})
