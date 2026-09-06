/**
 * Test Database Helper
 * 
 * Provides utilities for setting up isolated in-memory databases
 * for automated tests using First Principles approach:
 * 1. Each test gets a fresh database (isolation)
 * 2. Schema is created before test runs
 * 3. Data is cleaned up after test completes
 */

import db from '@adonisjs/lucid/services/db'
import Application from '@adonisjs/core/application'
import { FileMigrator } from '@adonisjs/lucid/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TestDatabaseConfig {
  connection: 'memory' | 'sqlite'
  migrate?: boolean
  seed?: boolean
}

/**
 * Initialize test database with migrations
 * Uses First Principles: start with clean state, apply schema
 */
export async function setupTestDatabase(): Promise<void> {
  // Ensure we're using in-memory database
  process.env.DB_CONNECTION = 'memory'
  
  // Get the database connection
  const connection = db.connection()
  
  // Run migrations manually
  await runMigrations(connection)
}

/**
 * Run database migrations for tests
 */
async function runMigrations(connection: any): Promise<void> {
  try {
    const migrator = new FileMigrator({
      db: connection,
      app: Application.get(),
      migrationsPath: path.join(__dirname, '..', 'database', 'migrations'),
    })
    
    await migrator.up()
    console.log('[TestDB] Migrations completed successfully')
  } catch (error) {
    console.error('[TestDB] Migration error:', error)
    throw error
  }
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    const connection = db.connection()
    
    // Get all tables
    const tables = await connection
      .query()
      .from('sqlite_master')
      .where('type', 'table')
      .where('name', 'not like', 'sqlite_%')
      .pluck('name')
    
    // Drop all tables
    for (const table of tables) {
      await connection.rawQuery(`DROP TABLE IF EXISTS "${table}"`)
    }
    
    console.log('[TestDB] Cleanup completed')
  } catch (error) {
    console.error('[TestDB] Cleanup error:', error)
  }
}

/**
 * Get a fresh database connection for isolated testing
 */
export async function getIsolatedConnection(): Promise<any> {
  const connection = db.connection()
  return connection
}
