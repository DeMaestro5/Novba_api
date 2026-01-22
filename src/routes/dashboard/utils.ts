/**
 * Format currency value
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const today = new Date();
  const endDate = new Date(today);
  const startDate = new Date(today);

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate.setDate(today.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(today.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(today.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(today.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(today.getMonth() - 1); // Default to last month
  }

  return { startDate, endDate };
}

/**
 * Format health score with status
 */
export function getHealthStatus(score: number): string {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'NEEDS_ATTENTION';
}