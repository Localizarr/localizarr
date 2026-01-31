import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import ImdbImportSeeder from '../database/seeders/imdb_import_seeder.js'

export default class ImportTitles extends BaseCommand {
  static commandName = 'import:titles'
  static description = 'Download and import IMDb titles data into the database'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🎬 Starting IMDb titles import...')

    try {
      // Execute the IMDb import seeder directly
      const seeder = new ImdbImportSeeder(this.app)
      await seeder.run()

      this.logger.success('✅ IMDb titles import completed successfully!')

    } catch (error) {
      this.logger.error('❌ IMDb titles import failed:', error.message)
      throw error
    }
  }
}
