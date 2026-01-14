import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ExecutionLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare routeUrl: string

  @column()
  declare targetUrl: string | null

  @column()
  declare indexerName: string | null

  @column()
  declare searchQuery: any | null

  @column()
  declare status: string

  @column()
  declare durationMs: number | null

  @column()
  declare originalResponseBody: string | null

  @column()
  declare processedResponseBody: string | null

  @column()
  declare llmPrompt: string | null

  @column()
  declare llmResponse: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
