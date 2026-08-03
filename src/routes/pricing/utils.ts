import { RateAIInsights } from '../../services/GeminiService';
import PricingRepo from '../../database/repository/PricingRepo';

type UnderchargingAnalysis = Awaited<
  ReturnType<typeof PricingRepo.analyzeUndercharging>
>;

interface BuildRateAnalysisArgs {
  rate: number;
  freelancerLocation: string;
  analysis: UnderchargingAnalysis;
  aiInsights: RateAIInsights | null;
}

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

export function buildRateAnalysisResponse({
  rate,
  freelancerLocation,
  analysis,
  aiInsights,
}: BuildRateAnalysisArgs) {
  const alert =
    aiInsights?.message ??
    formatPricingMessage(
      analysis.isUndercharging,
      analysis.percentBelow,
      analysis.potentialAnnualIncrease || 0,
    );

  const percentile = calculatePercentile(
    rate,
    analysis.marketMin || 0,
    analysis.marketMax || 0,
  );

  return {
    yourRate: rate,
    ...analysis,
    isUndercharging: aiInsights?.isUndercharging ?? analysis.isUndercharging,
    percentBelow: aiInsights?.percentBelow ?? analysis.percentBelow,
    annualGap: aiInsights?.annualGap ?? analysis.potentialAnnualIncrease ?? 0,
    suggestedRate: aiInsights?.suggestedRate ?? analysis.recommendedRate,
    alert,
    percentile,
    confidenceDescription: getConfidenceDescription(
      aiInsights?.confidence ?? analysis.confidence,
    ),
    reasoning: aiInsights?.reasoning ?? null,
    negotiationTips: aiInsights?.negotiationTips ?? [],
    negotiationBrief: aiInsights?.negotiationBrief ?? null,
    localRate: aiInsights?.localRate ?? null,
    internationalRate: aiInsights?.internationalRate ?? null,
    freelancerLocation,
    aiPowered: !!aiInsights,
  };
}
