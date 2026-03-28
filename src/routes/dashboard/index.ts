import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import DashboardRepo from '../../database/repository/DashboardRepo';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import { getDateRange, getHealthStatus } from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';

const router = express.Router();

router.use(authentication);

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
router.get(
  '/overview',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const cacheKey = CacheKeys.dashboardOverview(userId, req.query.startDate as string || '', req.query.endDate as string || '');
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Dashboard overview fetched successfully', cached as object).send(res);
    }

    const overview = await DashboardRepo.getOverview(userId, startDate, endDate);
    const data = { overview };
    await CacheService.set(cacheKey, data, TTL.DASHBOARD);

    new SuccessResponse('Dashboard overview fetched successfully', data).send(res);
  }),
);

// ─── INCOME CHART ─────────────────────────────────────────────────────────────
router.get(
  '/income-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const defaults = getDateRange('year');
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : defaults.startDate;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : defaults.endDate;

    const cacheKey = CacheKeys.dashboardIncomeChart(userId, req.query.startDate as string || '', req.query.endDate as string || '', groupBy);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Income chart data fetched successfully', cached as object).send(res);
    }

    const data = await DashboardRepo.getIncomeChart(userId, startDate, endDate, groupBy);
    const payload = { data, groupBy, dateRange: { startDate, endDate } };
    await CacheService.set(cacheKey, payload, TTL.DASHBOARD);

    new SuccessResponse('Income chart data fetched successfully', payload).send(res);
  }),
);

// ─── EXPENSES CHART ───────────────────────────────────────────────────────────
router.get(
  '/expenses-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const defaults = getDateRange('year');
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : defaults.startDate;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : defaults.endDate;

    const cacheKey = CacheKeys.dashboardExpensesChart(userId, req.query.startDate as string || '', req.query.endDate as string || '', groupBy);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Expenses chart data fetched successfully', cached as object).send(res);
    }

    const data = await DashboardRepo.getExpensesChart(userId, startDate, endDate, groupBy);
    const payload = { data, groupBy, dateRange: { startDate, endDate } };
    await CacheService.set(cacheKey, payload, TTL.DASHBOARD);

    new SuccessResponse('Expenses chart data fetched successfully', payload).send(res);
  }),
);

// ─── CLIENT REVENUE ───────────────────────────────────────────────────────────
router.get(
  '/client-revenue',
  validator(schema.clientRevenue),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const cacheKey = CacheKeys.dashboardClientRevenue(userId, limit);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Client revenue data fetched successfully', cached as object).send(res);
    }

    const clients = await DashboardRepo.getClientRevenue(userId, limit);
    const payload = { clients, limit };
    await CacheService.set(cacheKey, payload, TTL.DASHBOARD);

    new SuccessResponse('Client revenue data fetched successfully', payload).send(res);
  }),
);

// ─── CASH FLOW FORECAST ───────────────────────────────────────────────────────
router.get(
  '/cash-flow-forecast',
  validator(schema.forecast),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const months = parseInt(req.query.months as string) || 6;

    const cacheKey = CacheKeys.dashboardCashFlow(userId, months);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Cash flow forecast fetched successfully', cached as object).send(res);
    }

    const forecast = await DashboardRepo.getCashFlowForecast(userId, months);
    const payload = { forecast, forecastPeriod: `${months} months` };
    await CacheService.set(cacheKey, payload, TTL.CASH_FLOW);

    new SuccessResponse('Cash flow forecast fetched successfully', payload).send(res);
  }),
);

// ─── HEALTH METRICS ───────────────────────────────────────────────────────────
router.get(
  '/health-metrics',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;

    const cacheKey = CacheKeys.dashboardHealth(userId);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Health metrics fetched successfully', cached as object).send(res);
    }

    const metrics = await DashboardRepo.getHealthMetrics(userId);
    const payload = {
      metrics: {
        ...metrics,
        healthStatus: getHealthStatus(metrics.healthScore),
      },
    };
    await CacheService.set(cacheKey, payload, TTL.HEALTH_METRICS);

    new SuccessResponse('Health metrics fetched successfully', payload).send(res);
  }),
);

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────────────
router.get(
  '/recent-activity',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const cacheKey = CacheKeys.dashboardActivity(userId, limit);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Recent activity fetched successfully', cached as object).send(res);
    }

    const activity = await DashboardRepo.getRecentActivity(userId, limit);
    const payload = { activity };
    await CacheService.set(cacheKey, payload, TTL.DASHBOARD);

    new SuccessResponse('Recent activity fetched successfully', payload).send(res);
  }),
);

export default router;
