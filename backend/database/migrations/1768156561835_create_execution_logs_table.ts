import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'execution_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('route_url').notNullable()
      table.string('indexer_name').nullable()
      table.json('search_query').nullable()
      table.string('status').defaultTo('processing')
      table.integer('duration_ms').nullable()

      table.text('original_response_body').nullable()
      table.text('processed_response_body').nullable()

      table.text('llm_prompt').nullable()
      table.text('llm_response').nullable()

      table.timestamp('created_at').defaultTo(this.now())
      table.timestamp('updated_at').defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
