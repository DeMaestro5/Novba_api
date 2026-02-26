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

router.use(authentication);

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/overview
 *
 * Powers the 4 stat cards:
 *   revenue        → Total Revenue card  (total + percentageChange)
 *   pendingInvoices → Pending Invoices card (total + count)
 *   outstanding    → Outstanding card   (total + overdueCount)
 *   activeClients  → Active Clients card (count + percentageChange)
 *
 * Query params:
 *   startDate  (optional ISO date) — defaults to 1st of current month
 *   endDate    (optional ISO date) — defaults to today
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

// ─── INCOME CHART ─────────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/income-chart
 *
 * Powers the Revenue Overview chart — income (orange) line.
 * Call this in parallel with /expenses-chart and merge on the frontend.
 *
 * Query params:
 *   startDate  (optional) — defaults to 1 year ago
 *   endDate    (optional) — defaults to today
 *   groupBy    day | week | month (optional, default month)
 */
router.get(
  '/income-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const defaults = getDateRange('year');
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : defaults.startDate;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : defaults.endDate;

    const data = await DashboardRepo.getIncomeChart(
      req.user.id,
      startDate,
      endDate,
      groupBy,
    );

    new SuccessResponse('Income chart data fetched successfully', {
      data,
      groupBy,
      dateRange: { startDate, endDate },
    }).send(res);
  }),
);

// ─── EXPENSES CHART ───────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/expenses-chart
 *
 * Powers the Revenue Overview chart — expenses (grey) line.
 * Also returns byCategory breakdown for potential future use.
 *
 * Query params: same as /income-chart
 */
router.get(
  '/expenses-chart',
  validator(schema.dateRange),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const defaults = getDateRange('year');
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'month';

    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : defaults.startDate;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : defaults.endDate;

    const data = await DashboardRepo.getExpensesChart(
      req.user.id,
      startDate,
      endDate,
      groupBy,
    );

    new SuccessResponse('Expenses chart data fetched successfully', {
      data,
      groupBy,
      dateRange: { startDate, endDate },
    }).send(res);
  }),
);

// ─── CLIENT REVENUE ───────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/client-revenue
 *
 * Powers the Top Clients widget.
 * Returns clients sorted by total paid revenue, highest first.
 *
 * Query params:
 *   limit  (optional, 1–50, default 10)
 */
router.get(
  '/client-revenue',
  validator(schema.clientRevenue),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const clients = await DashboardRepo.getClientRevenue(req.user.id, limit);

    new SuccessResponse('Client revenue data fetched successfully', {
      clients,
      limit,
    }).send(res);
  }),
);

// ─── CASH FLOW FORECAST ───────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/cash-flow-forecast
 *
 * Powers the Cash Flow Forecast chart.
 * Returns monthlyForecast array with both `projected` and `conservative` values
 * so the frontend can render the two bar colors (dark = projected, light = conservative).
 *
 * Query params:
 *   months  (optional, 1–12, default 6)
 */
router.get(
  '/cash-flow-forecast',
  validator(schema.forecast),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const months = parseInt(req.query.months as string) || 6;
    const forecast = await DashboardRepo.getCashFlowForecast(
      req.user.id,
      months,
    );

    new SuccessResponse('Cash flow forecast fetched successfully', {
      forecast,
      forecastPeriod: `${months} months`,
    }).send(res);
  }),
);

// ─── HEALTH METRICS ───────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/health-metrics
 *
 * Powers the Business Health widget.
 * Returns healthScore (0–100), healthStatus label, and the 4 metric rows:
 *   collectionRate   → "Collection Rate   87%"
 *   avgPaymentTime   → "Avg Payment Time  12 days"
 *   clientRetention  → "Client Retention  92%"
 *   revenueGrowth    → "Revenue Growth    29.4%"
 */
router.get(
  '/health-metrics',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const metrics = await DashboardRepo.getHealthMetrics(req.user.id);

    new SuccessResponse('Health metrics fetched successfully', {
      metrics: {
        ...metrics,
        healthStatus: getHealthStatus(metrics.healthScore),
        // healthStatus will be one of: EXCELLENT | GOOD | FAIR | NEEDS_ATTENTION
      },
    }).send(res);
  }),
);

// ─── RECENT ACTIVITY ──────────────────────────────────────────────────────────
/**
 * GET /api/v1/dashboard/recent-activity
 *
 * Powers the Recent Activity feed.
 * Merges PAYMENT_RECEIVED + INVOICE_SENT + INVOICE_OVERDUE events,
 * sorted by most recent first.
 *
 * Each item shape:
 *   { id, type, clientName, invoiceNumber, amount, currency, timestamp }
 *
 * type values:
 *   PAYMENT_RECEIVED  → green "+$2.4k received"
 *   INVOICE_SENT      → neutral "$1.8k sent"
 *   INVOICE_OVERDUE   → red "$3.2k overdue"
 *
 * Query params:
 *   limit  (optional, default 10)
 */
router.get(
  '/recent-activity',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const activity = await DashboardRepo.getRecentActivity(req.user.id, limit);

    new SuccessResponse('Recent activity fetched successfully', {
      activity,
    }).send(res);
  }),
);

export default router;
