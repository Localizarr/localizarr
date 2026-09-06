import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'settings'
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key').notNullable().unique()
      table.text('value').nullable()
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }
  async down() {
    this.schema.dropTable(this.tableName)
  }
}
