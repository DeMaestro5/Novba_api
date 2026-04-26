import { Feedback, FeedbackType, FeedbackStatus, Prisma } from '@prisma/client';
import prisma from '..';

interface FeedbackWithUser extends Feedback {
  user: {
    id: string;
    name: string | null;
    email: string;
    profilePicUrl: string | null;
    subscriptionTier: string;
  };
}

async function create(data: {
  userId: string;
  type: FeedbackType;
  rating?: number;
  message: string;
}): Promise<Feedback> {
  return prisma.feedback.create({
    data: {
      userId: data.userId,
      type: data.type,
      rating: data.rating ?? null,
      message: data.message,
      status: FeedbackStatus.NEW,
    },
  });
}

async function findAll(
  page: number,
  limit: number,
  type?: FeedbackType,
  status?: FeedbackStatus,
): Promise<{ feedback: FeedbackWithUser[]; total: number }> {
  const where: Prisma.FeedbackWhereInput = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  const [feedback, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicUrl: true,
            subscriptionTier: true,
          },
        },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  return { feedback: feedback as FeedbackWithUser[], total };
}

async function updateStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
  return prisma.feedback.update({
    where: { id },
    data: { status, updatedAt: new Date() },
  });
}

async function getStats(): Promise<{
  total: number;
  newCount: number;
  byType: { type: string; count: number }[];
}> {
  const [total, newCount, byType] = await Promise.all([
    prisma.feedback.count(),
    prisma.feedback.count({ where: { status: FeedbackStatus.NEW } }),
    prisma.feedback.groupBy({
      by: ['type'],
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    newCount,
    byType: byType.map(b => ({ type: b.type, count: b._count._all })),
  };
}

export default { create, findAll, updateStatus, getStats };
