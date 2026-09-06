import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import Title from './app/models/title.js'

const APP_ROOT = new URL('../', import.meta.url)

async function run() {
  const ignitor = new Ignitor(APP_ROOT, {
    importer: (filePath) => import(filePath),
  })

  const app = ignitor.createApp('console')
  await app.init()
  await app.boot()

  const titles = await Title.all()
  console.log(`Checking ${titles.length} titles...`)

  for (const title of titles) {
    try {
      // Access dates to force parsing
      const c = title.createdAt
      const u = title.updatedAt
      if (!c || !u) {
        console.log(`Title ID ${title.id} (${title.imdbId}) has null dates: c=${c}, u=${u}`)
      }
    } catch (e) {
      console.log(`Title ID ${title.id} (${title.imdbId}) has CORRUPTED dates! Error: ${e.message}`)
    }
  }

  process.exit(0)
}

run()
