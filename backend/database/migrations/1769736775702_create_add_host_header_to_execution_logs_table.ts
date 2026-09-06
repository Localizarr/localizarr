import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'execution_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('host_header').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('host_header')
    })
  }
}