import prisma from '../index';
import { Payment, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

export interface CreatePaymentData {
  invoiceId: string;
  userId: string;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  stripePaymentIntentId?: string;
  status?: PaymentStatus;
  paidAt?: Date;
  notes?: string;
}

export interface UpdatePaymentData {
  amount?: number;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
  paidAt?: Date;
  notes?: string;
}

export interface PaymentWithDetails extends Payment {
  invoice: any;
}

/**
 * Check if payment exists and belongs to user
 */
async function existsForUser(id: string, userId: string): Promise<boolean> {
  const payment = await prisma.payment.findFirst({
    where: {
      id,
      userId,
    },
  });
  return payment !== null;
}

/**
 * Find payment by ID (only if belongs to user)
 */
async function findById(
  id: string,
  userId: string,
): Promise<PaymentWithDetails | null> {
  return prisma.payment.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      invoice: {
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Find payment by Stripe Payment Intent ID
 */
async function findByStripePaymentIntent(
  stripePaymentIntentId: string,
): Promise<Payment | null> {
  return prisma.payment.findFirst({
    where: {
      stripePaymentIntentId,
    },
  });
}

/**
 * Create new payment
 */
async function create(data: CreatePaymentData): Promise<PaymentWithDetails> {
  return prisma.payment.create({
    data: {
      invoiceId: data.invoiceId,
      userId: data.userId,
      amount: data.amount,
      currency: data.currency || 'USD',
      paymentMethod: data.paymentMethod,
      stripePaymentIntentId: data.stripePaymentIntentId,
      status: data.status || PaymentStatus.PENDING,
      paidAt: data.paidAt,
      notes: data.notes,
    },
    include: {
      invoice: {
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Update payment
 */
async function update(
  id: string,
  userId: string,
  data: UpdatePaymentData,
): Promise<PaymentWithDetails> {
  return prisma.payment.update({
    where: {
      id,
      userId,
    },
    data,
    include: {
      invoice: {
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Update payment status
 */
async function updateStatus(
  id: string,
  status: PaymentStatus,
  paidAt?: Date,
): Promise<Payment> {
  return prisma.payment.update({
    where: { id },
    data: {
      status,
      paidAt: paidAt || (status === PaymentStatus.COMPLETED ? new Date() : undefined),
    },
  });
}

/**
 * Delete payment (hard delete)
 */
async function remove(id: string, userId: string): Promise<Payment> {
  return prisma.payment.delete({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Get all payments for a user with pagination
 */
async function findAllByUser(
  userId: string,
  skip: number = 0,
  take: number = 20,
  status?: PaymentStatus,
  invoiceId?: string,
): Promise<PaymentWithDetails[]> {
  const where: Prisma.PaymentWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (invoiceId) {
    where.invoiceId = invoiceId;
  }

  return prisma.payment.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      invoice: {
        include: {
          client: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Count payments for a user
 */
async function countByUser(
  userId: string,
  status?: PaymentStatus,
  invoiceId?: string,
): Promise<number> {
  const where: Prisma.PaymentWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (invoiceId) {
    where.invoiceId = invoiceId;
  }

  return prisma.payment.count({ where });
}

/**
 * Get all payments for a specific invoice
 */
async function findAllByInvoice(invoiceId: string): Promise<Payment[]> {
  return prisma.payment.findMany({
    where: { invoiceId },
    orderBy: {
      paidAt: 'desc',
    },
  });
}

/**
 * Calculate total paid amount for an invoice
 */
async function getTotalPaidForInvoice(invoiceId: string): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      invoiceId,
      status: PaymentStatus.COMPLETED,
    },
    _sum: {
      amount: true,
    },
  });

  return Number(result._sum.amount || 0);
}

export default {
  existsForUser,
  findById,
  findByStripePaymentIntent,
  create,
  update,
  updateStatus,
  remove,
  findAllByUser,
  countByUser,
  findAllByInvoice,
  getTotalPaidForInvoice,
};