import prisma from '../index';


/**
 * Get dashboard overview statistics
 */
async function getOverview(userId: string, startDate?: Date, endDate?: Date) {
  // Build date filter
  const dateFilter: any = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  // Total Revenue (from paid invoices)
  const revenueData = await prisma.invoice.aggregate({
    where: {
      userId,
      status: 'PAID',
      ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
    },
    _sum: {
      total: true,
    },
  });

  // Outstanding Amount (sent but unpaid invoices)
  const outstandingData = await prisma.invoice.aggregate({
    where: {
      userId,
      status: {
        in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'],
      },
    },
    _sum: {
      total: true,
    },
  });

  // Get partially paid invoices to calculate actual outstanding
  const partiallyPaidInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: 'PARTIALLY_PAID',
    },
    include: {
      payments: {
        where: {
          status: 'COMPLETED',
        },
      },
    },
  });

  // Calculate actual outstanding (total - payments made)
  let actualOutstanding = Number(outstandingData._sum.total || 0);
  for (const invoice of partiallyPaidInvoices) {
    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const invoiceOutstanding = Number(invoice.total) - paidAmount;
    actualOutstanding = actualOutstanding - Number(invoice.total) + invoiceOutstanding;
  }

  // Total Expenses
  const expensesData = await prisma.expense.aggregate({
    where: {
      userId,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    },
    _sum: {
      amount: true,
    },
  });

  // Count statistics
  const [totalClients, activeProjects, totalInvoices, overdueInvoices] =
    await Promise.all([
      prisma.client.count({ where: { userId } }),
      prisma.project.count({ where: { userId, status: 'ACTIVE' } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId, status: 'OVERDUE' } }),
    ]);

  // Recent payments
  const recentPayments = await prisma.payment.findMany({
    where: {
      userId,
      status: 'COMPLETED',
    },
    take: 5,
    orderBy: {
      paidAt: 'desc',
    },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          client: {
            select: {
              companyName: true,
            },
          },
        },
      },
    },
  });

  return {
    revenue: {
      total: Number(revenueData._sum.total || 0),
      currency: 'USD', // TODO: Get from user preferences
    },
    outstanding: {
      total: actualOutstanding,
      currency: 'USD',
    },
    expenses: {
      total: Number(expensesData._sum.amount || 0),
      currency: 'USD',
    },
    profit: {
      total: Number(revenueData._sum.total || 0) - Number(expensesData._sum.amount || 0),
      currency: 'USD',
    },
    counts: {
      totalClients,
      activeProjects,
      totalInvoices,
      overdueInvoices,
    },
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidAt: payment.paidAt,
      invoiceNumber: payment.invoice.invoiceNumber,
      clientName: payment.invoice.client.companyName,
      paymentMethod: payment.paymentMethod,
    })),
  };
}

/**
 * Get income chart data (monthly breakdown)
 */
async function getIncomeChart(
  userId: string,
  startDate: Date,
  endDate: Date,
  groupBy: 'month' | 'week' | 'day' = 'month',
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: 'PAID',
      paidAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      total: true,
      paidAt: true,
      currency: true,
    },
    orderBy: {
      paidAt: 'asc',
    },
  });

  // Group by time period
  const grouped = new Map<string, number>();

  invoices.forEach((invoice) => {
    if (!invoice.paidAt) return;

    let key: string;
    const date = new Date(invoice.paidAt);

    if (groupBy === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const weekNum = getWeekNumber(date);
      key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    } else {
      key = date.toISOString().split('T')[0];
    }

    const current = grouped.get(key) || 0;
    grouped.set(key, current + Number(invoice.total));
  });

  // Convert to array and sort
  const data = Array.from(grouped.entries())
    .map(([period, amount]) => ({
      period,
      amount,
      currency: 'USD',
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return data;
}

/**
 * Get expenses chart data (monthly breakdown)
 */
async function getExpensesChart(
  userId: string,
  startDate: Date,
  endDate: Date,
  groupBy: 'month' | 'week' | 'day' = 'month',
) {
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      amount: true,
      date: true,
      category: true,
      currency: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  // Group by time period and category
  const groupedByPeriod = new Map<string, number>();
  const groupedByCategory = new Map<string, number>();

  expenses.forEach((expense) => {
    const date = new Date(expense.date);
    let key: string;

    if (groupBy === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const weekNum = getWeekNumber(date);
      key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    } else {
      key = date.toISOString().split('T')[0];
    }

    // By period
    const currentPeriod = groupedByPeriod.get(key) || 0;
    groupedByPeriod.set(key, currentPeriod + Number(expense.amount));

    // By category
    const currentCategory = groupedByCategory.get(expense.category) || 0;
    groupedByCategory.set(expense.category, currentCategory + Number(expense.amount));
  });

  const byPeriod = Array.from(groupedByPeriod.entries())
    .map(([period, amount]) => ({
      period,
      amount,
      currency: 'USD',
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const byCategory = Array.from(groupedByCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      currency: 'USD',
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    byPeriod,
    byCategory,
    total: expenses.reduce((sum, exp) => sum + Number(exp.amount), 0),
  };
}

/**
 * Get client revenue breakdown
 */
async function getClientRevenue(userId: string, limit: number = 10) {
  const clients = await prisma.client.findMany({
    where: { userId },
    include: {
      invoices: {
        where: {
          status: 'PAID',
        },
        select: {
          total: true,
        },
      },
      _count: {
        select: {
          invoices: true,
        },
      },
    },
  });

  const clientRevenue = clients
    .map((client) => {
      const totalRevenue = client.invoices.reduce(
        (sum, invoice) => sum + Number(invoice.total),
        0,
      );

      return {
        clientId: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        totalRevenue,
        totalInvoices: client._count.invoices,
        currency: client.currency,
      };
    })
    .filter((client) => client.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);

  return clientRevenue;
}

/**
 * Get cash flow forecast (based on invoice due dates)
 */
async function getCashFlowForecast(userId: string, months: number = 6) {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + months);

  // Get unpaid invoices with due dates
  const upcomingInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: {
        in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'],
      },
      dueDate: {
        lte: endDate,
      },
    },
    include: {
      payments: {
        where: {
          status: 'COMPLETED',
        },
      },
      client: {
        select: {
          companyName: true,
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  });

  // Calculate expected incoming cash
  const forecast = upcomingInvoices.map((invoice) => {
    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const expectedAmount = Number(invoice.total) - paidAmount;

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.client.companyName,
      dueDate: invoice.dueDate,
      expectedAmount,
      currency: invoice.currency,
      status: invoice.status,
      isOverdue: new Date(invoice.dueDate) < today,
    };
  });

  // Group by month
  const monthlyForecast = new Map<string, number>();
  forecast.forEach((item) => {
    const date = new Date(item.dueDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyForecast.get(key) || 0;
    monthlyForecast.set(key, current + item.expectedAmount);
  });

  const monthlyData = Array.from(monthlyForecast.entries())
    .map(([month, amount]) => ({
      month,
      expectedIncome: amount,
      currency: 'USD',
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    upcomingInvoices: forecast,
    monthlyForecast: monthlyData,
    totalExpected: forecast.reduce((sum, item) => sum + item.expectedAmount, 0),
  };
}

/**
 * Get business health metrics
 */
async function getHealthMetrics(userId: string) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Average payment time
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: 'PAID',
      paidAt: {
        not: null,
      },
    },
    select: {
      issueDate: true,
      paidAt: true,
      dueDate: true,
    },
  });

  const paymentTimes = paidInvoices.map((invoice) => {
    const issued = new Date(invoice.issueDate);
    const paid = new Date(invoice.paidAt!);
    return Math.floor((paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
  });

  const averagePaymentTime =
    paymentTimes.length > 0
      ? Math.round(paymentTimes.reduce((a, b) => a + b, 0) / paymentTimes.length)
      : 0;

  // On-time payment rate
  const onTimePayments = paidInvoices.filter((invoice) => {
    if (!invoice.paidAt) return false;
    return new Date(invoice.paidAt) <= new Date(invoice.dueDate);
  }).length;

  const onTimePaymentRate =
    paidInvoices.length > 0
      ? Math.round((onTimePayments / paidInvoices.length) * 100)
      : 0;

  // Revenue trend (comparing last 30 days to previous 30 days)
  const last30DaysRevenue = await prisma.invoice.aggregate({
    where: {
      userId,
      status: 'PAID',
      paidAt: {
        gte: thirtyDaysAgo,
      },
    },
    _sum: {
      total: true,
    },
  });

  const sixtyDaysAgo = new Date(thirtyDaysAgo);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 30);

  const previous30DaysRevenue = await prisma.invoice.aggregate({
    where: {
      userId,
      status: 'PAID',
      paidAt: {
        gte: sixtyDaysAgo,
        lt: thirtyDaysAgo,
      },
    },
    _sum: {
      total: true,
    },
  });

  const currentRevenue = Number(last30DaysRevenue._sum.total || 0);
  const previousRevenue = Number(previous30DaysRevenue._sum.total || 0);
  const revenueTrend =
    previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : 0;

  // Outstanding vs revenue ratio
  const outstandingData = await prisma.invoice.aggregate({
    where: {
      userId,
      status: {
        in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'],
      },
    },
    _sum: {
      total: true,
    },
  });

  const outstanding = Number(outstandingData._sum.total || 0);
  const outstandingRatio =
    currentRevenue > 0 ? Math.round((outstanding / currentRevenue) * 100) : 0;

  return {
    averagePaymentTime, // in days
    onTimePaymentRate, // percentage
    revenueTrend, // percentage change
    outstandingRatio, // percentage
    totalPaidInvoices: paidInvoices.length,
    healthScore: calculateHealthScore(
      averagePaymentTime,
      onTimePaymentRate,
      outstandingRatio,
    ),
  };
}

/**
 * Calculate overall business health score (0-100)
 */
function calculateHealthScore(
  avgPaymentTime: number,
  onTimeRate: number,
  outstandingRatio: number,
): number {
  let score = 100;

  // Deduct points for slow payments (target: 30 days or less)
  if (avgPaymentTime > 30) {
    score -= Math.min(30, (avgPaymentTime - 30) * 0.5);
  }

  // Deduct points for late payments (target: 80%+ on time)
  if (onTimeRate < 80) {
    score -= (80 - onTimeRate) * 0.5;
  }

  // Deduct points for high outstanding ratio (target: < 50%)
  if (outstandingRatio > 50) {
    score -= Math.min(30, (outstandingRatio - 50) * 0.5);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Helper: Get week number of the year
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export default {
  getOverview,
  getIncomeChart,
  getExpensesChart,
  getClientRevenue,
  getCashFlowForecast,
  getHealthMetrics,
};