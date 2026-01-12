import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class LlmCache extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare url: string | null

  @column()
  declare imdbId: string | null

  @column.dateTime()
  declare lastProcessedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}