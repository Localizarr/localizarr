import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'execution_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('method').nullable()
      table.text('request_body').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('method')
      table.dropColumn('request_body')
    })
  }
}
