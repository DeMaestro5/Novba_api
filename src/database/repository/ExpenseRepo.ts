import prisma from '../index';
import { Expense, ExpenseCategory, Prisma } from '@prisma/client';

export interface CreateExpenseData {
  userId: string;
  date: Date;
  vendor: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  description?: string;
  taxDeductible?: boolean;
  receiptUrl?: string;
}

export interface UpdateExpenseData {
  date?: Date;
  vendor?: string;
  amount?: number;
  currency?: string;
  category?: ExpenseCategory;
  description?: string;
  taxDeductible?: boolean;
  receiptUrl?: string;
}

/**
 * Check if expense exists and belongs to user
 */
async function existsForUser(id: string, userId: string): Promise<boolean> {
  const expense = await prisma.expense.findFirst({
    where: {
      id,
      userId,
    },
  });
  return expense !== null;
}

/**
 * Find expense by ID (only if belongs to user)
 */
async function findById(id: string, userId: string): Promise<Expense | null> {
  return prisma.expense.findFirst({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Create new expense
 */
async function create(data: CreateExpenseData): Promise<Expense> {
  return prisma.expense.create({
    data: {
      userId: data.userId,
      date: data.date,
      vendor: data.vendor,
      amount: data.amount,
      currency: data.currency || 'USD',
      category: data.category,
      description: data.description,
      taxDeductible: data.taxDeductible ?? false,
      receiptUrl: data.receiptUrl,
    },
  });
}

/**
 * Update expense
 */
async function update(
  id: string,
  userId: string,
  data: UpdateExpenseData,
): Promise<Expense> {
  return prisma.expense.update({
    where: {
      id,
      userId,
    },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete expense (hard delete)
 */
async function remove(id: string, userId: string): Promise<Expense> {
  return prisma.expense.delete({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Get all expenses for a user with pagination
 */
async function findAllByUser(
  userId: string,
  skip: number = 0,
  take: number = 20,
  category?: ExpenseCategory,
  search?: string,
  startDate?: Date,
  endDate?: Date,
  taxDeductible?: boolean,
): Promise<Expense[]> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
  };

  if (category) {
    where.category = category;
  }

  if (taxDeductible !== undefined) {
    where.taxDeductible = taxDeductible;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = startDate;
    }
    if (endDate) {
      where.date.lte = endDate;
    }
  }

  if (search) {
    where.OR = [
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.expense.findMany({
    where,
    skip,
    take,
    orderBy: {
      date: 'desc',
    },
  });
}

/**
 * Count expenses for a user
 */
async function countByUser(
  userId: string,
  category?: ExpenseCategory,
  search?: string,
  startDate?: Date,
  endDate?: Date,
  taxDeductible?: boolean,
): Promise<number> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
  };

  if (category) {
    where.category = category;
  }

  if (taxDeductible !== undefined) {
    where.taxDeductible = taxDeductible;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = startDate;
    }
    if (endDate) {
      where.date.lte = endDate;
    }
  }

  if (search) {
    where.OR = [
      { vendor: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  return prisma.expense.count({ where });
}

/**
 * Get all expenses for export (no pagination)
 */
async function findAllForExport(
  userId: string,
  category?: ExpenseCategory,
  startDate?: Date,
  endDate?: Date,
  taxDeductible?: boolean,
): Promise<Expense[]> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
  };

  if (category) {
    where.category = category;
  }

  if (taxDeductible !== undefined) {
    where.taxDeductible = taxDeductible;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = startDate;
    }
    if (endDate) {
      where.date.lte = endDate;
    }
  }

  return prisma.expense.findMany({
    where,
    orderBy: {
      date: 'desc',
    },
  });
}

/**
 * Get tax summary by category
 */
async function getTaxSummary(
  userId: string,
  year?: number,
): Promise<any[]> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
    taxDeductible: true,
  };

  if (year) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    where.date = {
      gte: startOfYear,
      lte: endOfYear,
    };
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      category: true,
      amount: true,
      currency: true,
    },
  });

  // Group by category
  const summary: any = {};
  expenses.forEach((expense) => {
    const category = expense.category;
    if (!summary[category]) {
      summary[category] = {
        category,
        totalAmount: 0,
        count: 0,
        currency: expense.currency,
      };
    }
    summary[category].totalAmount += Number(expense.amount);
    summary[category].count += 1;
  });

  return Object.values(summary);
}

/**
 * Get expense totals by category
 */
async function getTotalsByCategory(
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<any[]> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
  };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = startDate;
    }
    if (endDate) {
      where.date.lte = endDate;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      category: true,
      amount: true,
      taxDeductible: true,
    },
  });

  // Group by category
  const summary: any = {};
  expenses.forEach((expense) => {
    const category = expense.category;
    if (!summary[category]) {
      summary[category] = {
        category,
        totalAmount: 0,
        taxDeductibleAmount: 0,
        count: 0,
      };
    }
    summary[category].totalAmount += Number(expense.amount);
    if (expense.taxDeductible) {
      summary[category].taxDeductibleAmount += Number(expense.amount);
    }
    summary[category].count += 1;
  });

  return Object.values(summary);
}

export default {
  existsForUser,
  findById,
  create,
  update,
  remove,
  findAllByUser,
  countByUser,
  findAllForExport,
  getTaxSummary,
  getTotalsByCategory,
};