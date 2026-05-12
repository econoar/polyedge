import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  redis = Redis.fromEnv()
  return redis
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await getRedis()?.get<T>(key) ?? null
  } catch {
    return null
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await getRedis()?.set(key, value, { ex: ttlSeconds })
  } catch {
    // Redis unavailable — no-op, caller gets fresh data
  }
}
