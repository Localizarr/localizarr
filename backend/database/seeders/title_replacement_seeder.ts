import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Title from '#models/title'
import LocalizedName from '#models/localized_name'

export default class extends BaseSeeder {
  static environment = ['development', 'test']
  async run() {
    // Create title for Peacemaker/Pacificador
    const peacemakerTitle = await Title.firstOrCreate(
      { imdbId: 'tt14144906' },
      {
        mediaType: 'tv',
        originalTitle: 'Peacemaker',
      }
    )

    // Create localized names
    await LocalizedName.firstOrCreate(
      {
        titleId: peacemakerTitle.id,
        langId: 'pt-BR',
      },
      {
        localizedName: 'Pacificador',
      }
    )

    // Create title for The Boys/Os Garotos
    const theBoysTitle = await Title.firstOrCreate(
      { imdbId: 'tt0944947' },
      {
        mediaType: 'tv',
        originalTitle: 'The Boys',
      }
    )

    await LocalizedName.firstOrCreate(
      {
        titleId: theBoysTitle.id,
        langId: 'pt-BR',
      },
      {
        localizedName: 'Os Garotos',
      }
    )

    // Create title for Breaking Bad/Quebrando o Mau
    const breakingBadTitle = await Title.firstOrCreate(
      { imdbId: 'tt0903747' },
      {
        mediaType: 'tv',
        originalTitle: 'Breaking Bad',
      }
    )

    await LocalizedName.firstOrCreate(
      {
        titleId: breakingBadTitle.id,
        langId: 'pt-BR',
      },
      {
        localizedName: 'A Quimica do Mal',
      }
    )

    // Create title for Stranger Things/Coisas Estranhas
    const strangerThingsTitle = await Title.firstOrCreate(
      { imdbId: 'tt4574334' },
      {
        mediaType: 'tv',
        originalTitle: 'Stranger Things',
      }
    )

    await LocalizedName.firstOrCreate(
      {
        titleId: strangerThingsTitle.id,
        langId: 'pt-BR',
      },
      {
        localizedName: 'Coisas Estranhas',
      }
    )

    // Create title for Game of Thrones/Trono de Vidro
    const gameOfThronesTitle = await Title.firstOrCreate(
      { imdbId: 'tt0944947_2' },
      {
        mediaType: 'tv',
        originalTitle: 'Game of Thrones',
      }
    )

    await LocalizedName.firstOrCreate(
      {
        titleId: gameOfThronesTitle.id,
        langId: 'pt-BR',
      },
      {
        localizedName: 'A Guerra dos Tronos',
      }
    )
  }
}
