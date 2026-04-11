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
   *
   * Dates are formatted as YYYY-MM-DD (toISOString().split('T')[0]) to match
   * exactly what useDashboard.ts sends as query params for each period.
   */
  static async invalidateUserDashboard(userId: string): Promise<void> {
    const { CacheKeys } = await import('./keys');
    const now = new Date();

    // Frontend uses toISOString().split('T')[0] — always YYYY-MM-DD in UTC
    const toDateStr = (d: Date) => d.toISOString().split('T')[0];

    const endDate = toDateStr(now);

    // week: 7 days ago
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // month: first day of current month (UTC)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // quarter: 3 months ago
    const quarterStart = new Date(now);
    quarterStart.setMonth(now.getMonth() - 3);

    // year: 1 year ago
    const yearStart = new Date(now);
    yearStart.setFullYear(now.getFullYear() - 1);

    // Each entry mirrors a period in useDashboard.getDateRangeForPeriod
    const periods: Array<{ label: string; startDate: string; groupBy: string }> = [
      { label: 'week',    startDate: toDateStr(weekStart),    groupBy: 'day' },
      { label: 'month',   startDate: toDateStr(monthStart),   groupBy: 'week' },
      { label: 'quarter', startDate: toDateStr(quarterStart), groupBy: 'week' },
      { label: 'year',    startDate: toDateStr(yearStart),    groupBy: 'month' },
    ];

    const keysToDelete: string[] = [
      // Non-date-scoped keys
      CacheKeys.dashboardHealth(userId),
      CacheKeys.dashboardActivity(userId, 10),
      CacheKeys.dashboardActivity(userId, 5),
      CacheKeys.dashboardCashFlow(userId, 6),
      CacheKeys.dashboardClientRevenue(userId, 10),
      CacheKeys.dashboardClientRevenue(userId, 5),
      // Safety net: key shape when params are missing/undefined on the backend
      CacheKeys.dashboardOverview(userId, '', ''),
    ];

    for (const { label, startDate, groupBy } of periods) {
      const overviewKey  = CacheKeys.dashboardOverview(userId, startDate, endDate);
      const incomeKey    = CacheKeys.dashboardIncomeChart(userId, startDate, endDate, groupBy);
      const expensesKey  = CacheKeys.dashboardExpensesChart(userId, startDate, endDate, groupBy);
      Logger.info(`[Cache] invalidateUserDashboard [${label}] overview=${overviewKey}`);
      Logger.info(`[Cache] invalidateUserDashboard [${label}] income=${incomeKey}`);
      Logger.info(`[Cache] invalidateUserDashboard [${label}] expenses=${expensesKey}`);
      keysToDelete.push(overviewKey, incomeKey, expensesKey);
    }

    Logger.info(
      `[Cache] invalidateUserDashboard: deleting ${keysToDelete.length} keys for user ${userId}`,
    );

    await Promise.allSettled(keysToDelete.map((k) => CacheService.del(k)));

    // Also attempt pattern scan as fallback (may work on some Redis configs)
    await CacheService.invalidatePattern(
      CacheKeys.userDashboardPattern(userId),
    ).catch(() => {});
  }
}
