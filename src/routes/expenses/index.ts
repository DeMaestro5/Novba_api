import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import ExpenseRepo from '../../database/repository/ExpenseRepo';
import {
  BadRequestError,
  NotFoundError,
  InternalError,
} from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  getExpenseData,
  convertToCSV,
  calculateTotals,
} from './utils';
import { scanReceipt } from '../../services/receiptScan';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { ExpenseCategory } from '@prisma/client';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/expenses/export/csv
 * Export expenses to CSV
 * IMPORTANT: Must be before /:id route
 */
router.get(
  '/export/csv',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const category = (req.query.category as ExpenseCategory) || undefined;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    const taxDeductible =
      req.query.taxDeductible === 'true'
        ? true
        : req.query.taxDeductible === 'false'
        ? false
        : undefined;

    const expenses = await ExpenseRepo.findAllForExport(
      req.user.id,
      category,
      startDate,
      endDate,
      taxDeductible,
    );

    const csv = convertToCSV(expenses);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
    res.send(csv);
  }),
);

/**
 * GET /api/v1/expenses/tax-summary
 * Get tax deductible expenses summary
 * IMPORTANT: Must be before /:id route
 */
router.get(
  '/tax-summary',
  validator(schema.taxSummary),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    const summary = await ExpenseRepo.getTaxSummary(req.user.id, year);

    const totalTaxDeductible = summary.reduce(
      (sum, cat) => sum + cat.totalAmount,
      0,
    );
    const totalCount = summary.reduce((sum, cat) => sum + cat.count, 0);

    new SuccessResponse('Tax summary fetched successfully', {
      year: year || new Date().getFullYear(),
      totalTaxDeductible: Math.round(totalTaxDeductible * 100) / 100,
      totalExpenses: totalCount,
      byCategory: summary.map((cat) => ({
        ...cat,
        totalAmount: Math.round(cat.totalAmount * 100) / 100,
      })),
    }).send(res);
  }),
);

/**
 * GET /api/v1/expenses
 * Get all expenses for authenticated user with pagination
 */
router.get(
  '/',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = (req.query.category as ExpenseCategory) || undefined;
    const search = (req.query.search as string) || undefined;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate as string)
      : undefined;
    const endDate = req.query.endDate
      ? new Date(req.query.endDate as string)
      : undefined;
    const taxDeductible =
      req.query.taxDeductible === 'true'
        ? true
        : req.query.taxDeductible === 'false'
        ? false
        : undefined;

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      ExpenseRepo.findAllByUser(
        req.user.id,
        skip,
        limit,
        category,
        search,
        startDate,
        endDate,
        taxDeductible,
      ),
      ExpenseRepo.countByUser(
        req.user.id,
        category,
        search,
        startDate,
        endDate,
        taxDeductible,
      ),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Get totals for current filter
    const allExpensesForFilter = await ExpenseRepo.findAllForExport(
      req.user.id,
      category,
      startDate,
      endDate,
      taxDeductible,
    );
    const totals = calculateTotals(allExpensesForFilter);

    new SuccessResponse('Expenses fetched successfully', {
      expenses: expenses.map(getExpenseData),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      totals,
    }).send(res);
  }),
);

/**
 * POST /api/v1/expenses
 * Create new expense
 */
router.post(
  '/',
  validator(schema.create),
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Convert date
    const date = new Date(req.body.date);

    const expense = await ExpenseRepo.create({
      userId: req.user.id,
      date,
      vendor: req.body.vendor,
      amount: req.body.amount,
      currency: req.body.currency,
      category: req.body.category,
      description: req.body.description,
      taxDeductible: req.body.taxDeductible,
      receiptUrl: req.body.receiptUrl,
    });

    new SuccessResponse('Expense created successfully', {
      expense: getExpenseData(expense),
    }).send(res);
  }),
);

/**
 * GET /api/v1/expenses/:id
 * Get single expense by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const expense = await ExpenseRepo.findById(req.params.id, req.user.id);

    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    new SuccessResponse('Expense fetched successfully', {
      expense: getExpenseData(expense),
    }).send(res);
  }),
);

/**
 * PUT /api/v1/expenses/:id
 * Update expense
 */
router.put(
  '/:id',
  validator(schema.update),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ExpenseRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Expense not found');
    }

    // Convert date if provided
    const updateData: any = { ...req.body };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const expense = await ExpenseRepo.update(
      req.params.id,
      req.user.id,
      updateData,
    );

    new SuccessResponse('Expense updated successfully', {
      expense: getExpenseData(expense),
    }).send(res);
  }),
);

/**
 * DELETE /api/v1/expenses/:id
 * Delete expense
 */
router.delete(
  '/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ExpenseRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Expense not found');
    }

    await ExpenseRepo.remove(req.params.id, req.user.id);

    new SuccessResponse('Expense deleted successfully', {}).send(res);
  }),
);

/**
 * POST /api/v1/expenses/:id/receipt
 * Upload receipt for expense
 */
router.post(
  '/:id/receipt',
  validator(schema.receipt),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const expense = await ExpenseRepo.findById(req.params.id, req.user.id);

    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    const updatedExpense = await ExpenseRepo.update(
      req.params.id,
      req.user.id,
      {
        receiptUrl: req.body.receiptUrl,
      },
    );

    new SuccessResponse('Receipt uploaded successfully', {
      expense: getExpenseData(updatedExpense),
    }).send(res);
  }),
);

/**
 * POST /api/v1/expenses/scan-receipt
 * Scan receipt image (base64) and extract vendor, amount, date, category via OpenAI Vision.
 * Requires OPENAI_API_KEY. Returns extracted data for user to confirm before creating expense.
 */
router.post(
  '/scan-receipt',
  validator(schema.scanReceipt),
  asyncHandler(async (req: ProtectedRequest, res) => {
    let extractedData;
    try {
      extractedData = await scanReceipt(req.body.receiptImage);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Receipt scan failed';
      if (
        message.includes('not configured') ||
        message.includes('Invalid or too large') ||
        message.includes('invalid API key')
      ) {
        throw new BadRequestError(message);
      }
      if (message.includes('rate limit')) {
        throw new BadRequestError(message);
      }
      throw new InternalError('Receipt scan failed. Please try again.');
    }

    new SuccessResponse('Receipt scanned successfully', {
      extractedData: {
        ...extractedData,
        confidence: 1,
      },
      message:
        'Please review the extracted data and create the expense when ready.',
    }).send(res);
  }),
);

export default router;