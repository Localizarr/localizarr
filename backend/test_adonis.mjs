import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

const APP_ROOT = new URL('./', import.meta.url)
const IMPORTER = (filePath) => import(filePath)

console.log('Creating Ignitor...')
const ignitor = new Ignitor(APP_ROOT, { importer: IMPORTER })
console.log('Calling httpServer...')
const result = await ignitor.httpServer()
console.log('Result:', result)
console.log('Server should be running now')
