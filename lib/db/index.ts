import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>
let _db: Db | null = null

export function getDb(): Db {
  if (_db) return _db
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set')
  _db = drizzle(neon(process.env.DATABASE_URL), { schema })
  return _db
}

export function hasDb(): boolean {
  return !!process.env.DATABASE_URL
}
