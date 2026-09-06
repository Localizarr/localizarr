/**
 * Test Database Setup Script
 * 
 * This script runs migrations and seeds the in-memory test database.
 * It uses AdonisJS's infrastructure to properly set up the database.
 * 
 * Usage: node --import=tsx this_file.ts
 */

import 'reflect-metadata'
import { Application } from '@adonisjs/core/application'
import { FileMigrator } from '@adonisjs/lucid/migrator'
import db from '@adonisjs/lucid/services/db'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  console.log('[TestDB] Setting up test database...')
  
  // Set environment
  process.env.NODE_ENV = 'test'
  process.env.DB_CONNECTION = 'memory'
  
  try {
    // Wait for database connection
    await db.initialize()
    console.log('[TestDB] Database connection established')
    
    // Run migrations
    console.log('[TestDB] Running migrations...')
    const migrator = new FileMigrator({
      db: db.connection(),
      app: Application.get(),
      migrationsPath: path.join(__dirname, 'database', 'migrations'),
    })
    
    await migrator.up()
    console.log('[TestDB] Migrations completed')
    
    // Run seeders
    console.log('[TestDB] Running seeders...')
    
    // Import and run seeders manually
    const seederFiles = await import('./database/seeders/title_replacement_seeder.js')
    const seeder = new seederFiles.default(db)
    await seeder.run()
    
    console.log('[TestDB] Seeders completed')
    
    // Close connection - but keep schema for tests
    console.log('[TestDB] Database ready for tests!')
    
    // Don't close - keep it open for tests
    // await db.close()
    
  } catch (error) {
    console.error('[TestDB] Error:', error)
    process.exit(1)
  }
}

main()
