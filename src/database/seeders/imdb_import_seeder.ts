import { BaseSeeder } from '@adonisjs/lucid/seeders'

import axios from 'axios'
import * as fs from 'node:fs'
import * as zlib from 'node:zlib'
import csv from 'csv-parser'
import * as path from 'node:path'
import db from '@adonisjs/lucid/services/db'
import Title from '#models/title'

export default class extends BaseSeeder {
  static environment = ['development', 'test', 'production']
  private url = 'https://datasets.imdbws.com/title.basics.tsv.gz'
  private filePath = path.join(process.cwd(), 'tmp', 'title.basics.tsv.gz')
  private batchSize = 500 // Tamanho otimizado para SQLite

  async run() {
    console.log('🎬 Iniciando importação de dados do IMDb...')

    // Verificar se já existem títulos suficientes
    const titleCount = await Title.query().count('* as total')
    const count = titleCount[0].total

    console.log(`📊 Títulos existentes no banco: ${count}`)

    if (count >= 5) {
      console.log('⏭️  Já existem 5 ou mais títulos. Pulando importação do IMDb.')
      return
    }

    console.log('📥 Prosseguindo com a importação...')

    // Baixar arquivo se não existir
    await this.downloadFileIfNotExists()

    // Processar e importar dados
    await this.processAndImport()

    console.log('✅ Importação concluída!')
  }

  private async downloadFileIfNotExists() {
    if (fs.existsSync(this.filePath)) {
      console.log('📁 Arquivo já existe, pulando download...')
      return
    }

    console.log('📥 Baixando arquivo do IMDb...')

    // Garantir que o diretório tmp existe
    const tmpDir = path.dirname(this.filePath)
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }

    const writer = fs.createWriteStream(this.filePath)

    const response = await axios({
      url: this.url,
      method: 'GET',
      responseType: 'stream',
    })

    const totalLength = response.headers['content-length']
    let downloadedLength = 0

    response.data.on('data', (chunk: Buffer) => {
      downloadedLength += chunk.length
      const progress = ((downloadedLength / totalLength) * 100).toFixed(2)
      process.stdout.write(`\r📊 Progresso: ${progress}%`)
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('\n✅ Download concluído!')
        resolve(true)
      })
      writer.on('error', reject)
    })
  }

  private async processAndImport() {
    console.log('🔄 Processando arquivo TSV...')

    let batch: any[] = []
    let totalProcessed = 0
    let totalImported = 0
    let totalInserted = 0
    let totalUpdated = 0
    let totalSkipped = 0

    // Criar stream de leitura com descompactação
    const readStream = fs
      .createReadStream(this.filePath)
      .pipe(zlib.createGunzip())
      .pipe(
        csv({
          separator: '\t',
          headers: [
            'tconst',
            'titleType',
            'primaryTitle',
            'originalTitle',
            'isAdult',
            'startYear',
            'endYear',
            'runtimeMinutes',
            'genres',
          ],
          skipLines: 1, // Pular header
        })
      )

    for await (const row of readStream) {
      totalProcessed++

      // Filtrar apenas filmes e séries de TV
      if (!['movie', 'tvSeries', 'tvMiniSeries', 'tvMovie'].includes(row.titleType)) {
        totalSkipped++
        continue
      }

      // Ignorar conteúdo adulto
      if (row.isAdult === '1') {
        totalSkipped++
        continue
      }

      // Preparar dados para inserção
      const titleData = {
        imdb_id: row.tconst,
        media_type: row.titleType === 'movie' || row.titleType === 'tvMovie' ? 'movie' : 'tv',
        original_title:
          row.originalTitle === '\\N' || !row.originalTitle
            ? row.primaryTitle || 'Unknown'
            : row.originalTitle,
        imdb_data: JSON.stringify({
          primaryTitle: row.primaryTitle || 'Unknown',
          titleType: row.titleType,
          startYear: row.startYear === '\\N' ? null : row.startYear,
          endYear: row.endYear === '\\N' ? null : row.endYear,
          runtimeMinutes: row.runtimeMinutes === '\\N' ? null : row.runtimeMinutes,
          genres: row.genres === '\\N' ? null : row.genres,
        }),
        created_at: new Date(),
        updated_at: new Date(),
      }

      batch.push(titleData)

      // Inserir em lotes
      if (batch.length >= this.batchSize) {
        const result = await this.insertBatch(batch)
        totalImported += result.inserted + result.updated
        totalInserted += result.inserted
        totalUpdated += result.updated
        batch = []
        process.stdout.write(
          `\r📊 Processados: ${totalProcessed.toLocaleString()} | Importados: ${totalImported.toLocaleString()} | Atualizados: ${totalUpdated.toLocaleString()} | Ignorados: ${totalSkipped.toLocaleString()}`
        )
      }
    }

    // Inserir registros restantes
    if (batch.length > 0) {
      const result = await this.insertBatch(batch)
      totalImported += result.inserted + result.updated
      totalInserted += result.inserted
      totalUpdated += result.updated
    }

    console.log(`\n✅ Total processado: ${totalProcessed.toLocaleString()}`)
    console.log(`✅ Total importado (novos): ${totalInserted.toLocaleString()}`)
    console.log(`🔄 Total atualizado: ${totalUpdated.toLocaleString()}`)
    console.log(`⏭️  Total ignorado: ${totalSkipped.toLocaleString()}`)
  }

  private async insertBatch(batch: any[]): Promise<{ inserted: number; updated: number }> {
    const trx = await db.transaction()
    let insertedCount = 0
    let updatedCount = 0

    try {
      for (const item of batch) {
        try {
          if (!item.imdb_id || !item.original_title) {
            console.log('\n⚠️  Dados incompletos detectados:', item)
            continue
          }

          // Tentar inserir
          await trx.rawQuery(
            `INSERT INTO titles (imdb_id, media_type, original_title, imdb_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              item.imdb_id,
              item.media_type,
              item.original_title,
              item.imdb_data,
              item.created_at.toISOString(),
              item.updated_at.toISOString(),
            ]
          )
          insertedCount++
        } catch (e: any) {
          if (e.message?.includes('UNIQUE constraint failed')) {
            // Se erro de UNIQUE, fazer UPDATE
            await trx.rawQuery(
              `UPDATE titles SET
                media_type = ?,
                original_title = ?,
                imdb_data = ?,
                updated_at = ?
               WHERE imdb_id = ?`,
              [
                item.media_type,
                item.original_title,
                item.imdb_data,
                item.updated_at.toISOString(),
                item.imdb_id,
              ]
            )
            updatedCount++
          } else {
            console.log('\n⚠️  Erro inesperado no item:', item.imdb_id)
            console.log('Mensagem:', e.message)
          }
        }
      }

      await trx.commit()
      return { inserted: insertedCount, updated: updatedCount }
    } catch (error: any) {
      await trx.rollback()
      console.log('\n❌ ERRO NA TRANSAÇÃO:')
      console.log('Mensagem:', error.message)
      console.log('Código:', error.code)
      console.log('Tamanho do lote:', batch.length)
      throw error
    }
  }
}
