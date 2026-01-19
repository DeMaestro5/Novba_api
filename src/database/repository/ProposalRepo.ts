import prisma from '../index';
import { Proposal, ProposalStatus, Prisma } from '@prisma/client';

export interface CreateProposalData {
  userId: string;
  clientId: string;
  proposalNumber: string;
  title: string;
  scope?: string;
  deliverables?: any;
  timeline?: any;
  terms?: string;
  totalAmount: number;
  currency?: string;
  validUntil?: Date;
  lineItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    order: number;
  }>;
}

export interface UpdateProposalData {
  title?: string;
  scope?: string;
  deliverables?: any;
  timeline?: any;
  terms?: string;
  totalAmount?: number;
  currency?: string;
  validUntil?: Date;
  lineItems?: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    order: number;
  }>;
}

// ADD THIS: Specific type for status update additional data
export interface StatusUpdateData {
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  pdfUrl?: string;
}

export interface ProposalWithDetails extends Proposal {
  lineItems: any[];
  client: any;
}

/**
 * Check if proposal exists and belongs to user
 */
async function existsForUser(id: string, userId: string): Promise<boolean> {
  const proposal = await prisma.proposal.findFirst({
    where: {
      id,
      userId,
    },
  });
  return proposal !== null;
}

/**
 * Find proposal by ID (only if belongs to user)
 */
async function findById(
  id: string,
  userId: string,
): Promise<ProposalWithDetails | null> {
  return prisma.proposal.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      lineItems: {
        orderBy: {
          order: 'asc',
        },
      },
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Generate next proposal number for user
 */
async function generateProposalNumber(userId: string): Promise<string> {
  const lastProposal = await prisma.proposal.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { proposalNumber: true },
  });

  if (!lastProposal) {
    return 'PROP-0001';
  }

  // Extract number from format PROP-0001
  const match = lastProposal.proposalNumber.match(/PROP-(\d+)/);
  if (match) {
    const nextNumber = parseInt(match[1], 10) + 1;
    return `PROP-${nextNumber.toString().padStart(4, '0')}`;
  }

  return 'PROP-0001';
}

/**
 * Create new proposal with line items
 */
async function create(data: CreateProposalData): Promise<ProposalWithDetails> {
  const { lineItems, ...proposalData } = data;

  return prisma.proposal.create({
    data: {
      ...proposalData,
      lineItems: {
        create: lineItems,
      },
    },
    include: {
      lineItems: {
        orderBy: {
          order: 'asc',
        },
      },
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update proposal and line items
 */
async function update(
  id: string,
  userId: string,
  data: UpdateProposalData,
): Promise<ProposalWithDetails> {
  const { lineItems, ...proposalData } = data;

  // If line items provided, delete old ones and create new ones
  if (lineItems) {
    await prisma.proposalLineItem.deleteMany({
      where: { proposalId: id },
    });

    return prisma.proposal.update({
      where: {
        id,
        userId,
      },
      data: {
        ...proposalData,
        updatedAt: new Date(),
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        lineItems: {
          orderBy: {
            order: 'asc',
          },
        },
        client: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
          },
        },
      },
    });
  }

  return prisma.proposal.update({
    where: {
      id,
      userId,
    },
    data: {
      ...proposalData,
      updatedAt: new Date(),
    },
    include: {
      lineItems: {
        orderBy: {
          order: 'asc',
        },
      },
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update proposal status
 * FIXED: Changed additionalData type and return type
 */
async function updateStatus(
  id: string,
  userId: string,
  status: ProposalStatus,
  additionalData?: StatusUpdateData,
): Promise<Proposal> {
  return prisma.proposal.update({
    where: {
      id,
      userId,
    },
    data: {
      status,
      ...additionalData,
      updatedAt: new Date(),
    },
  });
}

/**
 * Delete proposal (hard delete)
 */
async function remove(id: string, userId: string): Promise<Proposal> {
  return prisma.proposal.delete({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Get all proposals for a user with pagination
 */
async function findAllByUser(
  userId: string,
  skip: number = 0,
  take: number = 20,
  status?: ProposalStatus,
  search?: string,
): Promise<ProposalWithDetails[]> {
  const where: Prisma.ProposalWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { proposalNumber: { contains: search, mode: 'insensitive' } },
      {
        client: {
          companyName: { contains: search, mode: 'insensitive' },
        },
      },
    ];
  }

  return prisma.proposal.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      lineItems: {
        orderBy: {
          order: 'asc',
        },
      },
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Count proposals for a user
 */
async function countByUser(
  userId: string,
  status?: ProposalStatus,
  search?: string,
): Promise<number> {
  const where: Prisma.ProposalWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { proposalNumber: { contains: search, mode: 'insensitive' } },
      {
        client: {
          companyName: { contains: search, mode: 'insensitive' },
        },
      },
    ];
  }

  return prisma.proposal.count({ where });
}

/**
 * Duplicate proposal
 * FIXED: Proper handling of nullable JSON fields
 */
async function duplicate(
  id: string,
  userId: string,
  newProposalNumber: string,
): Promise<ProposalWithDetails> {
  const original = await findById(id, userId);

  if (!original) {
    throw new Error('Proposal not found');
  }

  return prisma.proposal.create({
    data: {
      userId: original.userId,
      clientId: original.clientId,
      proposalNumber: newProposalNumber,
      title: `${original.title} (Copy)`,
      status: ProposalStatus.DRAFT,
      scope: original.scope,
      // FIXED: Proper handling of nullable JSON fields
      deliverables: original.deliverables ?? Prisma.JsonNull,
      timeline: original.timeline ?? Prisma.JsonNull,
      terms: original.terms,
      totalAmount: original.totalAmount,
      currency: original.currency,
      validUntil: original.validUntil,
      lineItems: {
        create: original.lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          order: item.order,
        })),
      },
    },
    include: {
      lineItems: {
        orderBy: {
          order: 'asc',
        },
      },
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Mark proposal as sent
 */
async function markAsSent(id: string, userId: string): Promise<Proposal> {
  return prisma.proposal.update({
    where: {
      id,
      userId,
    },
    data: {
      status: ProposalStatus.SENT,
      sentAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark proposal as viewed
 */
async function markAsViewed(id: string, userId: string): Promise<Proposal> {
  return prisma.proposal.update({
    where: {
      id,
      userId,
    },
    data: {
      status: ProposalStatus.VIEWED,
      viewedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export default {
  existsForUser,
  findById,
  generateProposalNumber,
  create,
  update,
  updateStatus,
  remove,
  findAllByUser,
  countByUser,
  duplicate,
  markAsSent,
  markAsViewed,
};
