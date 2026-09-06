import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'titles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('imdb_id').unique().notNullable() // IMDb ID (tt1234567)
      table.string('media_type').notNullable() // 'movie' or 'tv'
      table.string('original_title').notNullable() // Original title from IMDb
      table.json('imdb_data').nullable() // Optional: Store full IMDb data for reference

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
