import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'proxy_caches'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('url').notNullable()
      table.string('method').notNullable()
      table.text('response_body').nullable()
      table.text('response_headers').nullable()
      table.integer('status_code').notNullable()
      table.timestamp('expires_at').notNullable()

      table.index(['url'])
      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}