import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import prisma from '../../database';
import PricingRepo from '../../database/repository/PricingRepo';
import MarketRatesRepo from '../../database/repository/MarketRatesRepo';
import ProjectEstimatorRepo from '../../database/repository/ProjectEstimatorRepo';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  formatPricingMessage,
  getConfidenceDescription,
  calculatePercentile,
} from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

function generateDeterministicInsights(context: {
  category: string; experienceLevel: string; effectiveRate: number;
  marketMedian: number; totalInvoices: number; totalRevenue: number;
  avgDaysToPay: number; overdueRate: number; revenueGrowth: number;
  topClientRevenuePct: number; expenseToRevenueRatio: number;
}) {
  const insights: Array<{id: string; type: string; title: string; description: string; impact: string; priority: string}> = [];
  let i = 1;

  // Rate gap
  if (context.effectiveRate > 0 && context.effectiveRate < context.marketMedian * 0.85) {
    const gap = context.marketMedian - context.effectiveRate;
    const annual = Math.round(gap * 40 * 48);
    insights.push({ id: `insight_${i++}`, type: 'opportunity', title: 'You\'re below market rate', description: `Your effective rate of $${context.effectiveRate}/hr is $${Math.round(gap)}/hr below the $${context.marketMedian}/hr market median for ${context.category}. Raising your rate to market level would significantly increase your earnings.`, impact: `+$${annual.toLocaleString()}/year potential`, priority: 'HIGH' });
  } else if (context.effectiveRate >= context.marketMedian) {
    insights.push({ id: `insight_${i++}`, type: 'positive', title: 'Competitive rate', description: `Your rate of $${context.effectiveRate}/hr meets or exceeds the $${context.marketMedian}/hr market median for ${context.category}. You\'re well-positioned in your market.`, impact: 'Keep raising annually', priority: 'LOW' });
  }

  // Client concentration
  if (context.topClientRevenuePct >= 70) {
    insights.push({ id: `insight_${i++}`, type: 'warning', title: 'Client concentration risk', description: `${context.topClientRevenuePct}% of your $${context.totalRevenue.toLocaleString()} revenue comes from a single client. Losing this client would eliminate most of your income.`, impact: 'Diversify to <60% per client', priority: 'HIGH' });
  }

  // Payment speed
  if (context.avgDaysToPay > 21) {
    insights.push({ id: `insight_${i++}`, type: 'warning', title: 'Slow payment collection', description: `Your invoices take ${context.avgDaysToPay} days on average to get paid — ${context.avgDaysToPay - 14} days longer than the 14-day industry standard. This hurts your cash flow.`, impact: 'Add payment reminders', priority: 'HIGH' });
  } else if (context.avgDaysToPay > 0 && context.avgDaysToPay <= 14) {
    insights.push({ id: `insight_${i++}`, type: 'positive', title: 'Fast payment collection', description: `Your clients pay in ${context.avgDaysToPay} days on average — faster than the 14-day industry standard. Your payment terms and follow-up are working well.`, impact: 'Maintain current terms', priority: 'LOW' });
  }

  // Overdue rate
  if (context.overdueRate > 20) {
    insights.push({ id: `insight_${i++}`, type: 'warning', title: 'High overdue rate', description: `${context.overdueRate}% of your invoices are overdue. This indicates either overly lenient payment terms or clients who consistently pay late.`, impact: 'Set up auto-reminders', priority: 'HIGH' });
  }

  // Revenue growth
  if (context.revenueGrowth > 20) {
    insights.push({ id: `insight_${i++}`, type: 'positive', title: 'Strong revenue growth', description: `Your revenue grew ${context.revenueGrowth}% compared to the prior 3-month period. This is a strong signal — consider raising rates to capture more value while demand is high.`, impact: 'Time to raise rates', priority: 'MEDIUM' });
  } else if (context.revenueGrowth < -10) {
    insights.push({ id: `insight_${i++}`, type: 'warning', title: 'Revenue declining', description: `Revenue dropped ${Math.abs(context.revenueGrowth)}% vs the prior 3 months. This could indicate project pipeline gaps or seasonal slowdown.`, impact: 'Review pipeline now', priority: 'HIGH' });
  }

  // Tip — always include a strategic tip
  if (context.totalInvoices < 10) {
    insights.push({ id: `insight_${i++}`, type: 'tip', title: 'Build your invoice history', description: `With ${context.totalInvoices} invoices so far, you\'re building your track record. Each completed project strengthens your case for higher rates and better clients.`, impact: 'More data = better insights', priority: 'LOW' });
  } else {
    insights.push({ id: `insight_${i++}`, type: 'tip', title: 'Annual rate review', description: `With ${context.totalInvoices} invoices completed, you have strong leverage to justify a rate increase. Schedule a review every 12 months minimum.`, impact: 'Raises every 12 months', priority: 'MEDIUM' });
  }

  return insights.slice(0, 5);
}

/**
 * GET /api/v1/pricing/insights
 * Get comprehensive pricing insights for user
 */
router.get(
  '/insights',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Check Pro access — first 100 users get lifetime access automatically
    const isPro =
      req.user.lifetimeAccess === true ||
      req.user.subscriptionTier === 'PRO' ||
      req.user.subscriptionTier === 'STUDIO';

    if (!isPro) {
      return new SuccessResponse('Pricing insights fetched successfully', {
        insights: [],
        isPro: false,
        hasAccess: false,
      }).send(res);
    }

    // Build rich context from user's real data
    const [insightContext, avgRate, user] = await Promise.all([
      PricingRepo.buildInsightContext(req.user.id),
      PricingRepo.calculateAverageRate(req.user.id),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          industry: true,
          experienceLevel: true,
          averageHourlyRate: true,
        },
      }),
    ]);

    const category = user?.industry || 'Web Development';
    const experienceLevel = user?.experienceLevel || 'INTERMEDIATE';
    const currentRate = avgRate || user?.averageHourlyRate?.toNumber() || 0;

    // Get market data for this user's category
    const marketRates = MarketRatesRepo.getMarketRates(
      category,
      undefined,
      experienceLevel,
    );
    const marketData = marketRates[0] ?? {
      medianRate: 75,
      minRate: 40,
      maxRate: 150,
    };

    // Generate AI insights with Gemini
    const { generatePricingInsightsWithAI } = await import(
      '../../services/GeminiService'
    );

    let insights: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      impact: string;
      priority: string;
    }> = [];

    // If avgRate is 0 (project-based billing), estimate from total revenue
    const effectiveRate = currentRate > 0
      ? currentRate
      : insightContext.totalRevenue > 0 && insightContext.totalInvoices > 0
        ? Math.round(insightContext.totalRevenue / (insightContext.totalInvoices * 8)) // assume ~8hr avg project
        : marketData.medianRate; // fall back to market median

    try {
      insights = await generatePricingInsightsWithAI({
        category,
        experienceLevel,
        avgRate: effectiveRate,
        marketMedian: marketData.medianRate,
        marketMin: marketData.minRate,
        marketMax: marketData.maxRate,
        ...insightContext,
      });
    } catch (err) {
      console.error('[Gemini] generatePricingInsightsWithAI failed:', { message: (err as Error)?.message });
      // Generate real insights from data without AI
      insights = generateDeterministicInsights({
        category, experienceLevel, effectiveRate,
        marketMedian: marketData.medianRate,
        ...insightContext,
      });
    }

    return new SuccessResponse('Pricing insights fetched successfully', {
      insights,
      isPro: true,
      hasAccess: true,
    }).send(res);
  }),
);

/**
 * GET /api/v1/pricing/market-rates
 * Get market rates by category
 */
router.get(
  '/market-rates',
  validator(schema.marketRates),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const category = req.query.category as string | undefined;
    const subcategory = req.query.subcategory as string | undefined;
    const experienceLevel = req.query.experienceLevel as string | undefined;

    const marketRates = MarketRatesRepo.getMarketRates(
      category,
      subcategory,
      experienceLevel,
    );

    const categories = MarketRatesRepo.getCategories();
    const subcategories = category
      ? MarketRatesRepo.getSubcategories(category)
      : [];

    new SuccessResponse('Market rates fetched successfully', {
      marketRates,
      availableCategories: categories,
      availableSubcategories: subcategories,
      totalResults: marketRates.length,
    }).send(res);
  }),
);

/**
 * POST /api/v1/pricing/analyze-rate
 * Analyze a specific rate against market data
 */
router.post(
  '/analyze-rate',
  validator(schema.analyzeRate),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { rate, category, experienceLevel } = req.body;

    const analysis = await PricingRepo.analyzeUndercharging(
      req.user.id,
      rate,
      category,
      experienceLevel,
    );

    // Enhance with Gemini AI insights
    const { analyzeRateWithAI } = await import('../../services/GeminiService');
    let aiInsights: {
      message: string;
      suggestedRate: number;
      confidence: number;
      reasoning: string;
      negotiationTips: string[];
    } | null = null;
    try {
      aiInsights = await analyzeRateWithAI({
        role: category,
        experienceLevel,
        currentRate: rate,
        marketMin: analysis.marketMin ?? 0,
        marketMax: analysis.marketMax ?? 0,
        marketMedian: analysis.marketMedian,
        marketAverage: analysis.marketAverage,
        sampleSize: analysis.sampleSize ?? 500,
      });
    } catch (err) {
      console.error('[Gemini] analyze-rate failed:', err);
    }

    const message =
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

    new SuccessResponse('Rate analysis completed', {
      analysis: {
        yourRate: rate,
        ...analysis,
        suggestedRate: aiInsights?.suggestedRate ?? analysis.recommendedRate,
        alert: message,
        percentile,
        confidenceDescription: getConfidenceDescription(
          aiInsights?.confidence ?? analysis.confidence,
        ),
        reasoning: aiInsights?.reasoning ?? null,
        negotiationTips: aiInsights?.negotiationTips ?? [],
        aiPowered: !!aiInsights,
      },
    }).send(res);
  }),
);

/**
 * GET /api/v1/pricing/recommendations
 * Get personalized pricing recommendations
 */
router.get(
  '/recommendations',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const base = await PricingRepo.generateRecommendations(req.user.id);

    // Try Gemini-enhanced recommendations
    const { generateRecommendationsWithAI } = await import(
      '../../services/GeminiService'
    );
    let recommendations = base.recommendations;
    let aiPowered = false;

    if (base.marketData) {
      try {
        const user = await (
          await import('../../database')
        ).default.user.findUnique({
          where: { id: req.user.id },
          select: { industry: true, experienceLevel: true },
        });
        recommendations = await generateRecommendationsWithAI({
          currentRate: base.currentRate,
          marketMedian: base.marketData.medianRate,
          experienceLevel: user?.experienceLevel ?? 'INTERMEDIATE',
          category: user?.industry ?? 'Freelance',
          invoiceCount: 0,
        });
        aiPowered = true;
      } catch {
        // Fall back to static recommendations
      }
    }

    new SuccessResponse('Pricing recommendations fetched successfully', {
      currentRate: base.currentRate,
      recommendations,
      marketBenchmark: base.marketData,
      actionItems: recommendations
        .filter((r) => r.priority === 'HIGH')
        .map((r) => r.title),
      aiPowered,
    }).send(res);
  }),
);

/**
 * POST /api/v1/pricing/estimate-project
 * Estimate project value based on description
 */
router.post(
  '/estimate-project',
  validator(schema.estimateProject),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { description, projectType } = req.body;

    // Try Gemini first, fall back to static estimator
    const { estimateProjectWithAI } = await import(
      '../../services/GeminiService'
    );
    let estimate;
    let aiPowered = false;

    try {
      estimate = await estimateProjectWithAI({
        description,
        projectType: projectType ?? 'FIXED',
      });
      aiPowered = true;
    } catch {
      estimate = ProjectEstimatorRepo.estimateProject(
        description,
        projectType ?? 'FIXED',
      );
    }

    new SuccessResponse('Project estimated successfully', {
      estimate: {
        ...estimate,
        currency: 'USD',
        aiPowered,
        disclaimer: aiPowered
          ? 'AI-powered estimate based on current market rates and project analysis. Actual value may vary based on client budget and final scope.'
          : 'Estimate based on market data analysis. Actual project value may vary based on client, scope, and market conditions.',
      },
    }).send(res);
  }),
);

export default router;
