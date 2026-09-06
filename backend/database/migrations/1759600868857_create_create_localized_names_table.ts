import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'localized_names'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('title_id').unsigned().references('id').inTable('titles').onDelete('CASCADE')
      table.string('lang_id').notNullable() // Language ID (pt-BR, en-US, etc.)
      table.string('localized_name').notNullable() // Localized name to replace with

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
