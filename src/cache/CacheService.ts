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
  static async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
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
        Logger.debug(
          `[Cache] Invalidated ${keysToDelete.length} keys matching: ${pattern}`,
        );
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
    // Upstash SCAN is unreliable — explicitly delete all known dashboard key shapes
    // rather than relying on pattern scanning
    const now = new Date();

    const keysToDelete = [
      CacheKeys.dashboardHealth(userId),
      CacheKeys.dashboardActivity(userId, 10),
      CacheKeys.dashboardActivity(userId, 5),
      CacheKeys.dashboardCashFlow(userId, 6),
      CacheKeys.dashboardClientRevenue(userId, 10),
      CacheKeys.dashboardClientRevenue(userId, 5),
      // Delete overview keys for current and adjacent date ranges
      // by generating keys for common startDate/endDate combos
      CacheKeys.dashboardOverview(userId, '', ''),
    ];

    // Generate the exact overview cache key the frontend would have requested
    // useDashboard passes startDate/endDate computed from selectedPeriod
    // Delete keys for all period variants
    const year = now.getFullYear();
    const month = now.getMonth();
    const dateVariants: [string, string][] = [
      // month (default)
      [new Date(year, month, 1).toISOString(), now.toISOString()],
      // empty (no date params)
      ['', ''],
    ];
    dateVariants.forEach(([s, e]) => {
      keysToDelete.push(CacheKeys.dashboardOverview(userId, s, e));
      keysToDelete.push(CacheKeys.dashboardIncomeChart(userId, s, e, 'week'));
      keysToDelete.push(CacheKeys.dashboardIncomeChart(userId, s, e, 'month'));
      keysToDelete.push(
        CacheKeys.dashboardExpensesChart(userId, s, e, 'month'),
      );
    });
    // Delete all without waiting — fire and forget is fine here
    await Promise.allSettled(keysToDelete.map((k) => CacheService.del(k)));

    // Also attempt pattern scan as fallback (may work on some Redis configs)
    await CacheService.invalidatePattern(
      CacheKeys.userDashboardPattern(userId),
    ).catch(() => {});
  }
}
