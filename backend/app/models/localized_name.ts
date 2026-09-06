import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Title from './title.js'

export default class LocalizedName extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare titleId: number

  @column()
  declare langId: string

  @column()
  declare localizedName: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Title)
  declare title: BelongsTo<typeof Title>
}
