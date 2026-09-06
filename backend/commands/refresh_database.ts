import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'

export default class RefreshDatabase extends BaseCommand {
  static commandName = 'db:refresh'
  static description = 'Reset database, run migrations and seed data'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔄 Starting database refresh...')

    try {
      // Step 1: Rollback all migrations
      this.logger.info('⬇️  Rolling back all migrations...')
      await this.kernel.exec('migration:rollback', [])

      // Step 2: Run all migrations
      this.logger.info('⬆️  Running all migrations...')
      await this.kernel.exec('migration:run', [])

      // Step 3: Run seeders (this will download and import titles)
      this.logger.info('🌱 Running database seeders...')
      await this.kernel.exec('db:seed', [])

      this.logger.success('✅ Database refresh completed successfully!')
      this.logger.info('📊 Database is now up to date with latest schema and data.')

    } catch (error) {
      this.logger.error('❌ Database refresh failed:', error.message)
      throw error
    }
  }
}
