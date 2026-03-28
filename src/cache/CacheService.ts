import { getRedis } from './index';
import Logger from '../core/Logger';

export class CacheService {
  /**
   * Get a cached value. Returns null if not found or Redis is unavailable.
   */
  static async get<T>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
      const value = await redis.get<T>(key);
      if (value !== null) {
        Logger.debug(`[Cache] HIT: ${key}`);
      }
      return value;
    } catch (err) {
      Logger.warn(`[Cache] GET failed for key ${key}`, err);
      return null;
    }
  }

  /**
   * Set a cached value with TTL in seconds.
   */
  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      await redis.set(key, value, { ex: ttlSeconds });
      Logger.debug(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
    } catch (err) {
      Logger.warn(`[Cache] SET failed for key ${key}`, err);
    }
  }

  /**
   * Delete a single key.
   */
  static async del(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      await redis.del(key);
      Logger.debug(`[Cache] DEL: ${key}`);
    } catch (err) {
      Logger.warn(`[Cache] DEL failed for key ${key}`, err);
    }
  }

  /**
   * Invalidate all keys matching a pattern using SCAN.
   * Safe for production — does not use KEYS command.
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
      let cursor = 0;
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await redis.scan(cursor, {
          match: pattern,
          count: 100,
        });
        cursor = Number(nextCursor);
        keysToDelete.push(...keys);
      } while (cursor !== 0);

      if (keysToDelete.length > 0) {
        await Promise.all(keysToDelete.map((k) => redis.del(k)));
        Logger.debug(`[Cache] Invalidated ${keysToDelete.length} keys matching: ${pattern}`);
      }
    } catch (err) {
      Logger.warn(`[Cache] Pattern invalidation failed for ${pattern}`, err);
    }
  }

  /**
   * Convenience: invalidate dashboard + a specific list for a user.
   * Call this after any mutation that affects counts or totals.
   */
  static async invalidateUserDashboard(userId: string): Promise<void> {
    const { CacheKeys } = await import('./keys');
    await CacheService.invalidatePattern(CacheKeys.userDashboardPattern(userId));
  }
}
