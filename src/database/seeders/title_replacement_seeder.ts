import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'

export default class extends BaseSeeder {
  async run() {
    // Create title for Peacemaker/Pacificador
    const peacemakerTitle = await Title.create({
      imdbId: 'tt14144906', // Peacemaker IMDb ID
      mediaType: 'tv',
      originalTitle: 'Peacemaker',
    })

    // Create localized names - these are the names that should replace indexer results
    await LocalizedName.create({
      titleId: peacemakerTitle.id,
      langId: 'pt-BR',
      localizedName: 'Pacificador',
    })

    // Create title for The Boys/Os Garotos
    const theBoysTitle = await Title.create({
      imdbId: 'tt0944947', // The Boys IMDb ID
      mediaType: 'tv',
      originalTitle: 'The Boys',
    })

    await LocalizedName.create({
      titleId: theBoysTitle.id,
      langId: 'pt-BR',
      localizedName: 'Os Garotos',
    })

    // Create title for Breaking Bad/Quebrando o Mau
    const breakingBadTitle = await Title.create({
      imdbId: 'tt0903747', // Breaking Bad IMDb ID
      mediaType: 'tv',
      originalTitle: 'Breaking Bad',
    })

    await LocalizedName.create({
      titleId: breakingBadTitle.id,
      langId: 'pt-BR',
      localizedName: 'A Quimica do Mal',
    })

    // Create title for Stranger Things/Coisas Estranhas
    const strangerThingsTitle = await Title.create({
      imdbId: 'tt4574334', // Stranger Things IMDb ID
      mediaType: 'tv',
      originalTitle: 'Stranger Things',
    })

    await LocalizedName.create({
      titleId: strangerThingsTitle.id,
      langId: 'pt-BR',
      localizedName: 'Coisas Estranhas',
    })

    // Create title for Game of Thrones/Trono de Vidro
    const gameOfThronesTitle = await Title.create({
      imdbId: 'tt0944947_2', // Game of Thrones IMDb ID (placeholder)
      mediaType: 'tv',
      originalTitle: 'Game of Thrones',
    })

    await LocalizedName.create({
      titleId: gameOfThronesTitle.id,
      langId: 'pt-BR',
      localizedName: 'Trono de Vidro',
    })
  }
}
