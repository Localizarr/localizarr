import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ProxyCache extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare url: string

  @column()
  declare method: string

  @column()
  declare responseBody: string

  @column()
  declare responseHeaders: string

  @column()
  declare statusCode: number

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}