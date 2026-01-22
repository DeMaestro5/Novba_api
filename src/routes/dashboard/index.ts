import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import DashboardRepo from '../../database/repository/DashboardRepo';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import { getDateRange, getHealthStatus } from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/dashboard/overview
 * Get high-level dashboard overview
 */
router.get(
  '/overview',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;

    const overview = await DashboardRepo.getOverview(
      req.user.id,
      startDate,
      endDate,
    );

    new SuccessResponse('Dashboard overview fetched successfully', {
      overview,
    }).send(res);
  }),
);

/**
 * GET /api/v1/dashboard/income-chart
 * Get income/revenue chart data
 */
router.get(
  '/income-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { startDate, endDate } = getDateRange('year'); // Default to last year
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const customStartDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : startDate;
    const customEndDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : endDate;

    const incomeData = await DashboardRepo.getIncomeChart(
      req.user.id,
      customStartDate,
      customEndDate,
      groupBy,
    );

    new SuccessResponse('Income chart data fetched successfully', {
      data: incomeData,
      groupBy,
      dateRange: {
        startDate: customStartDate,
        endDate: customEndDate,
      },
    }).send(res);
  }),
);

/**
 * GET /api/v1/dashboard/expenses-chart
 * Get expenses chart data
 */
router.get(
  '/expenses-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { startDate, endDate } = getDateRange('year'); // Default to last year
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const customStartDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : startDate;
    const customEndDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : endDate;

    const expensesData = await DashboardRepo.getExpensesChart(
      req.user.id,
      customStartDate,
      customEndDate,
      groupBy,
    );

    new SuccessResponse('Expenses chart data fetched successfully', {
      data: expensesData,
      groupBy,
      dateRange: {
        startDate: customStartDate,
        endDate: customEndDate,
      },
    }).send(res);
  }),
);

/**
 * GET /api/v1/dashboard/client-revenue
 * Get top clients by revenue
 */
router.get(
  '/client-revenue',
  validator(schema.clientRevenue),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 10;

    const clientRevenue = await DashboardRepo.getClientRevenue(req.user.id, limit);

    new SuccessResponse('Client revenue data fetched successfully', {
      clients: clientRevenue,
      limit,
    }).send(res);
  }),
);

/**
 * GET /api/v1/dashboard/cash-flow-forecast
 * Get cash flow forecast based on upcoming invoices
 */
router.get(
  '/cash-flow-forecast',
  validator(schema.forecast),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const months = parseInt(req.query.months as string) || 6;

    const forecast = await DashboardRepo.getCashFlowForecast(req.user.id, months);

    new SuccessResponse('Cash flow forecast fetched successfully', {
      forecast,
      forecastPeriod: `${months} months`,
    }).send(res);
  }),
);

/**
 * GET /api/v1/dashboard/health-metrics
 * Get business health metrics
 */
router.get(
  '/health-metrics',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const metrics = await DashboardRepo.getHealthMetrics(req.user.id);

    new SuccessResponse('Health metrics fetched successfully', {
      metrics: {
        ...metrics,
        healthStatus: getHealthStatus(metrics.healthScore),
      },
    }).send(res);
  }),
);

export default router;