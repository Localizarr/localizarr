import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import LocalizedName from './localized_name.js'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Title extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare imdbId: string

  @column()
  declare mediaType: string

  @column()
  declare originalTitle: string

  @column()
  declare imdbData: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => LocalizedName)
  declare localizedNames: HasMany<typeof LocalizedName>
}
