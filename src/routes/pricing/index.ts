import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
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
    const insights = await PricingRepo.getPricingInsights(req.user.id);

    const message = formatPricingMessage(
      insights.summary.isUndercharging,
      insights.summary.percentBelow,
      insights.summary.potentialIncrease || 0
    );

    const percentile = calculatePercentile(
      insights.summary.currentRate,
      insights.comparison.marketMin || 0,
      insights.comparison.marketMax || 0,
    );

    new SuccessResponse('Pricing insights fetched successfully', {
      insights: {
        ...insights,
        alert: message,
        percentile,
        confidenceDescription: getConfidenceDescription(
          insights.comparison.confidence,
        ),
      },
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

    const message = formatPricingMessage(
      analysis.isUndercharging,
      analysis.percentBelow,
      analysis.potentialAnnualIncrease || 0
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
        alert: message,
        percentile,
        confidenceDescription: getConfidenceDescription(analysis.confidence),
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
    const recommendations = await PricingRepo.generateRecommendations(
      req.user.id,
    );

    new SuccessResponse('Pricing recommendations fetched successfully', {
      currentRate: recommendations.currentRate,
      recommendations: recommendations.recommendations,
      marketBenchmark: recommendations.marketData,
      actionItems: recommendations.recommendations
        .filter((r) => r.priority === 'HIGH')
        .map((r) => r.title),
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

    const estimate = ProjectEstimatorRepo.estimateProject(description, projectType ?? 'FIXED');

    new SuccessResponse('Project estimated successfully', {
      estimate: {
        ...estimate,
        currency: 'USD',
        disclaimer: 'Estimates based on market data analysis. Actual project value may vary based on client, scope, and market conditions.',
      },
    }).send(res);
  }),
);

export default router;