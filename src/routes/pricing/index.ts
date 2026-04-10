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
        select: { industry: true, experienceLevel: true, averageHourlyRate: true },
      }),
    ]);

    const category = user?.industry || 'Web Development';
    const experienceLevel = user?.experienceLevel || 'INTERMEDIATE';
    const currentRate = avgRate || user?.averageHourlyRate?.toNumber() || 0;

    // Get market data for this user's category
    const marketRates = MarketRatesRepo.getMarketRates(category, undefined, experienceLevel);
    const marketData = marketRates[0] ?? {
      medianRate: 75,
      minRate: 40,
      maxRate: 150,
    };

    // Generate AI insights with Gemini
    const { generatePricingInsightsWithAI } = await import('../../services/GeminiService');

    let insights: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      impact: string;
      priority: string;
    }> = [];

    try {
      insights = await generatePricingInsightsWithAI({
        category,
        experienceLevel,
        avgRate: currentRate,
        marketMedian: marketData.medianRate,
        marketMin: marketData.minRate,
        marketMax: marketData.maxRate,
        ...insightContext,
      });
    } catch (err) {
      console.error('[Gemini] generatePricingInsightsWithAI failed:', err);
      // Fall back to static insights so Pro users always get something
      insights = [
        {
          id: 'fallback_1',
          type: 'tip',
          title: 'Add more invoices for insights',
          description:
            'Your AI insights are generated from your real invoice data. Send and complete more invoices to unlock personalized analysis.',
          impact: 'More data = more accurate insights',
          priority: 'MEDIUM',
        },
      ];
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
