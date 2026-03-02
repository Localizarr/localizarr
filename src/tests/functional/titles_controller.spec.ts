import { test } from '@japa/runner'
import '@japa/api-client/types'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'

test.group('TitlesController - Functional Tests', (group) => {
  group.each.setup(async () => {
    // Clean up any existing data
    await LocalizedName.query().delete()
    await Title.query().delete()
  })

  test('successfully creates a title with localized name via API', async ({ assert, client }) => {
    const payload = {
      originalTitle: 'Star Quest',
      imdbId: 'tt9999999',
      mediaType: 'movie',
      langId: 'pt-BR',
      localizedName: 'Missão Estelar'
    }

    const response = await client
      .post('/api/titles')
      .json(payload)
      .header('Accept', 'application/json')

    // Check if response is successful
    if (response.status() !== 201) {
      console.error('Unexpected status:', response.status())
      console.error('Response body:', response.body())
    }

    response.assertStatus(201)
    response.assertBodyContains({
      success: true
    })

    // Verify the title was created in the database
    const titles = await Title.query().where('imdbId', 'tt9999999')
    assert.equal(titles.length, 1)
    assert.equal(titles[0].originalTitle, 'Star Quest')

    // Verify the localized name was created
    const localizedNames = await LocalizedName.query()
      .where('title_id', titles[0].id)
      .where('lang_id', 'pt-BR')

    assert.equal(localizedNames.length, 1)
    assert.equal(localizedNames[0].localizedName, 'Missão Estelar')
  })
})