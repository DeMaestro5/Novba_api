import prisma from '../index';
import MarketRatesRepo from './MarketRatesRepo';

/**
 * Get user's historical rates from invoices
 */
async function getUserHistoricalRates(userId: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: {
        in: ['PAID', 'SENT', 'PARTIALLY_PAID'],
      },
    },
    include: {
      lineItems: true,
    },
    orderBy: {
      issueDate: 'desc',
    },
  });

  // Extract rates from line items
  const rates: Array<{
    description: string;
    rate: number;
    quantity: number;
    total: number;
    date: Date;
  }> = [];

  invoices.forEach((invoice) => {
    invoice.lineItems.forEach((item) => {
      rates.push({
        description: item.description,
        rate: Number(item.rate),
        quantity: Number(item.quantity),
        total: Number(item.amount),
        date: invoice.issueDate,
      });
    });
  });

  return rates;
}

/**
 * Calculate user's average hourly rate
 */
async function calculateAverageRate(userId: string): Promise<number> {
  const rates = await getUserHistoricalRates(userId);

  if (rates.length === 0) return 0;

  // Filter for hourly rates (quantities that look like hours)
  const hourlyRates = rates.filter((r) => r.quantity > 0 && r.quantity <= 200);

  if (hourlyRates.length === 0) return 0;

  const avgRate =
    hourlyRates.reduce((sum, r) => sum + r.rate, 0) / hourlyRates.length;

  return Math.round(avgRate * 100) / 100;
}

/**
 * Analyze if user is undercharging
 */
async function analyzeUndercharging(
  userId: string,
  userRate: number,
  category: string,
  experienceLevel: string,
) {
  // Get market rates for comparison
  const marketRates = MarketRatesRepo.getMarketRates(
    category,
    undefined,
    experienceLevel,
  );

  if (marketRates.length === 0) {
    return {
      isUndercharging: false,
      percentBelow: 0,
      marketAverage: 0,
      marketMedian: 0,
      message: 'No market data available for this category',
      confidence: 0,
    };
  }

  // Use the most relevant market rate
  const marketData = marketRates[0];
  const marketMedian = marketData.medianRate;
  const marketAverage = marketData.avgRate;

  // Calculate how far below market rate
  const percentBelowMedian = ((marketMedian - userRate) / marketMedian) * 100;
  const percentBelowAverage = ((marketAverage - userRate) / marketAverage) * 100;

  const isUndercharging = userRate < marketMedian;

  // Calculate confidence based on sample size
  const confidence = Math.min(
    100,
    Math.round((marketData.sampleSize / 1000) * 100),
  );

  return {
    isUndercharging,
    percentBelow: Math.round(percentBelowMedian),
    percentBelowAverage: Math.round(percentBelowAverage),
    marketAverage,
    marketMedian,
    marketMin: marketData.minRate,
    marketMax: marketData.maxRate,
    recommendedRate: marketMedian,
    potentialAnnualIncrease: calculatePotentialIncrease(
      userRate,
      marketMedian,
    ),
    message: isUndercharging
      ? `You're charging ${Math.abs(Math.round(percentBelowMedian))}% below market rates`
      : 'Your rates are competitive with market standards',
    confidence,
    sampleSize: marketData.sampleSize,
  };
}

/**
 * Calculate potential annual income increase
 */
function calculatePotentialIncrease(
  currentRate: number,
  marketRate: number,
): number {
  // Assume 40 billable hours per week, 48 weeks per year
  const annualHours = 40 * 48;
  const currentAnnual = currentRate * annualHours;
  const marketAnnual = marketRate * annualHours;
  return Math.round(marketAnnual - currentAnnual);
}

/**
 * Generate personalized pricing recommendations
 */
async function generateRecommendations(userId: string) {
  // Get user profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      industry: true,
      experienceLevel: true,
      averageHourlyRate: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get user's historical rates
  const historicalRates = await getUserHistoricalRates(userId);
  const currentAvgRate = await calculateAverageRate(userId);

  // Determine experience level
  const experienceLevel = user.experienceLevel || 'INTERMEDIATE';
  const category = user.industry || 'Web Development';

  // Get market data
  const marketRates = MarketRatesRepo.getMarketRates(
    category,
    undefined,
    experienceLevel,
  );

  const recommendations: Array<{
    type: string;
    title: string;
    description: string;
    impact: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];

  if (marketRates.length > 0) {
    const marketData = marketRates[0];

    // Recommendation 1: Adjust base rate
    if (currentAvgRate < marketData.medianRate) {
      const increase = marketData.medianRate - currentAvgRate;
      const percentIncrease = ((increase / currentAvgRate) * 100).toFixed(0);
      const annualImpact = calculatePotentialIncrease(
        currentAvgRate,
        marketData.medianRate,
      );

      recommendations.push({
        type: 'RATE_INCREASE',
        title: 'Increase Your Hourly Rate',
        description: `Based on ${marketData.sampleSize.toLocaleString()} similar professionals, you could increase your rate from $${currentAvgRate}/hr to $${marketData.medianRate}/hr (${percentIncrease}% increase)`,
        impact: `Potential annual income increase: $${annualImpact.toLocaleString()}`,
        priority: 'HIGH',
      });
    }

    // Recommendation 2: Experience-based pricing
    if (experienceLevel !== 'EXPERT') {
      const nextLevel =
        experienceLevel === 'BEGINNER' ? 'INTERMEDIATE' : 'EXPERT';
      const nextLevelRates = MarketRatesRepo.getMarketRates(
        category,
        undefined,
        nextLevel,
      );

      if (nextLevelRates.length > 0) {
        recommendations.push({
          type: 'SKILL_UPGRADE',
          title: 'Build Skills for Higher Rates',
          description: `${nextLevel.toLowerCase()} professionals in your field charge $${nextLevelRates[0].medianRate}/hr on average`,
          impact: `Potential increase: $${(nextLevelRates[0].medianRate - marketData.medianRate).toFixed(0)}/hr`,
          priority: 'MEDIUM',
        });
      }
    }

    // Recommendation 3: Value-based pricing
    if (historicalRates.length > 5) {
      recommendations.push({
        type: 'VALUE_PRICING',
        title: 'Consider Value-Based Pricing',
        description:
          'Instead of hourly rates, price projects based on the value delivered to clients',
        impact: 'Can increase project revenue by 50-200%',
        priority: 'MEDIUM',
      });
    }

    // Recommendation 4: Minimum project rates
    const minProjectRate = marketData.medianRate * 20; // Minimum 20 hours
    recommendations.push({
      type: 'MINIMUM_PROJECT',
      title: 'Set Minimum Project Rates',
      description: `Set a minimum project rate of $${minProjectRate.toLocaleString()} to ensure profitable engagements`,
      impact: 'Filters out low-value projects and increases average revenue',
      priority: 'MEDIUM',
    });

    // Recommendation 5: Annual rate review
    recommendations.push({
      type: 'ANNUAL_REVIEW',
      title: 'Schedule Annual Rate Reviews',
      description:
        'Review and adjust your rates annually to keep pace with market changes and your growing experience',
      impact: 'Ensures steady income growth over time',
      priority: 'LOW',
    });
  }

  return {
    currentRate: currentAvgRate,
    recommendations,
    marketData: marketRates.length > 0 ? marketRates[0] : null,
  };
}

/**
 * Get pricing insights dashboard
 */
async function getPricingInsights(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      industry: true,
      experienceLevel: true,
      averageHourlyRate: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get historical data
  const historicalRates = await getUserHistoricalRates(userId);
  const currentAvgRate = await calculateAverageRate(userId);

  // Get market comparison
  const experienceLevel = user.experienceLevel || 'INTERMEDIATE';
  const category = user.industry || 'Web Development';

  const underchargingAnalysis = await analyzeUndercharging(
    userId,
    currentAvgRate || user.averageHourlyRate?.toNumber() || 0,
    category,
    experienceLevel,
  );

  // Calculate stats
  const totalInvoices = historicalRates.length;
  const recentRates = historicalRates.slice(0, 10);
  const recentAvg =
    recentRates.length > 0
      ? recentRates.reduce((sum, r) => sum + r.rate, 0) / recentRates.length
      : 0;

  return {
    summary: {
      currentRate: currentAvgRate || user.averageHourlyRate?.toNumber() || 0,
      marketRate: underchargingAnalysis.marketMedian,
      isUndercharging: underchargingAnalysis.isUndercharging,
      percentBelow: underchargingAnalysis.percentBelow,
      potentialIncrease: underchargingAnalysis.potentialAnnualIncrease,
    },
    comparison: underchargingAnalysis,
    historical: {
      totalInvoices,
      averageRate: currentAvgRate,
      recentAverageRate: Math.round(recentAvg * 100) / 100,
      lowestRate: historicalRates.length > 0
        ? Math.min(...historicalRates.map((r) => r.rate))
        : 0,
      highestRate: historicalRates.length > 0
        ? Math.max(...historicalRates.map((r) => r.rate))
        : 0,
    },
    category,
    experienceLevel,
  };
}

export default {
  getUserHistoricalRates,
  calculateAverageRate,
  analyzeUndercharging,
  generateRecommendations,
  getPricingInsights,
};