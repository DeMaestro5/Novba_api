import prisma from '..';

async function getOverview() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    onboardingCompleted,
    tierDistribution,
    foundingMembers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    totalInvoices,
    totalPaymentsCompleted,
    totalPaymentVolume,
    waitlistCount,
    stripeConnectedUsers,
    activeLast24h,
    activeLast7Days,
    activeLast30Days,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { verified: true } }),
    prisma.user.count({ where: { onboardingCompleted: true } }),
    prisma.user.groupBy({ by: ['subscriptionTier'], _count: { _all: true } }),
    prisma.user.count({ where: { lifetimeAccess: true } }),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.invoice.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.waitlistEmail.count(),
    prisma.user.count({ where: { stripeAccountId: { not: null } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: twentyFourHoursAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      onboardingCompleted,
      foundingMembers,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek,
      newThisMonth: newUsersThisMonth,
      stripeConnected: stripeConnectedUsers,
      tierDistribution: tierDistribution.map(t => ({
        tier: t.subscriptionTier,
        count: t._count._all,
      })),
    },
    activity: {
      activeLast24h,
      activeLast7Days,
      activeLast30Days,
    },
    invoices: {
      total: totalInvoices,
    },
    payments: {
      completed: totalPaymentsCompleted,
      totalVolume: Number(totalPaymentVolume._sum.amount ?? 0),
    },
    waitlist: {
      total: waitlistCount,
    },
  };
}

async function getUserGrowth(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const grouped: Record<string, number> = {};
  for (const user of users) {
    const date = user.createdAt.toISOString().slice(0, 10);
    grouped[date] = (grouped[date] ?? 0) + 1;
  }

  return Object.entries(grouped)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getUsers(page: number, limit: number, search?: string) {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        verified: true,
        onboardingCompleted: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        lifetimeAccess: true,
        lastLoginAt: true,
        createdAt: true,
        stripeAccountId: true,
        _count: { select: { invoices: true, clients: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(u => ({
      ...u,
      stripeAccountId: u.stripeAccountId !== null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getUserDetail(userId: string) {
  const [user, invoiceStats, paymentStats, clientCount, recentInvoices] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { subscriptions: true },
      }),
      prisma.invoice.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.payment.aggregate({
        where: { userId, status: 'COMPLETED' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.client.count({ where: { userId } }),
      prisma.invoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      }),
    ]);

  if (!user) return null;

  return {
    user,
    stats: {
      invoiceCount: invoiceStats._count._all,
      totalInvoiceValue: Number(invoiceStats._sum.total ?? 0),
      paymentCount: paymentStats._count._all,
      totalPaid: Number(paymentStats._sum.amount ?? 0),
      clientCount,
    },
    recentInvoices,
  };
}

async function getWaitlist(page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [emails, total] = await Promise.all([
    prisma.waitlistEmail.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.waitlistEmail.count(),
  ]);

  return {
    emails,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default { getOverview, getUserGrowth, getUsers, getUserDetail, getWaitlist };
