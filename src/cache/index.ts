import { Redis } from '@upstash/redis';
import Logger from '../core/Logger';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export async function initCache(): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    Logger.warn('[Cache] UPSTASH_REDIS_REST_URL or TOKEN not set — caching disabled');
    return;
  }

  try {
    redis = new Redis({ url, token });
    // Verify connection
    await redis.ping();
    Logger.info('[Cache] Redis connected via Upstash REST');
  } catch (err) {
    Logger.error('[Cache] Redis connection failed — caching disabled', err);
    redis = null;
  }
}
