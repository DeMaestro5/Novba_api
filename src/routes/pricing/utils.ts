/**
 * Format pricing insight message
 */
export function formatPricingMessage(
  isUndercharging: boolean,
  percentBelow: number,
  potentialIncrease: number,
): string {
  if (!isUndercharging) {
    return '✅ Your rates are competitive with market standards. Great job!';
  }

  if (percentBelow > 40) {
    return `🚨 ALERT: You're undercharging by ${percentBelow}%. This could cost you $${potentialIncrease.toLocaleString()}/year. Consider raising your rates immediately.`;
  }

  if (percentBelow > 20) {
    return `⚠️ You're ${percentBelow}% below market rate. Increasing to market rates could earn you an extra $${potentialIncrease.toLocaleString()}/year.`;
  }

  return `💡 You're slightly below market rate (${percentBelow}%). Small rate adjustments could increase your annual income by $${potentialIncrease.toLocaleString()}.`;
}

/**
 * Get confidence level description
 */
export function getConfidenceDescription(confidence: number): string {
  if (confidence >= 90) return 'Very High - Based on extensive market data';
  if (confidence >= 70) return 'High - Reliable market comparison';
  if (confidence >= 50) return 'Medium - Reasonable market sample';
  return 'Low - Limited market data available';
}

/**
 * Calculate rate percentile
 */
export function calculatePercentile(
  userRate: number,
  min: number,
  max: number,
): number {
  if (userRate <= min) return 0;
  if (userRate >= max) return 100;

  return Math.round(((userRate - min) / (max - min)) * 100);
}