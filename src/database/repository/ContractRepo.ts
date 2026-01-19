import prisma from '../index';
import { Contract, ContractStatus, Prisma } from '@prisma/client';

export interface CreateContractData {
  userId: string;
  clientId: string;
  proposalId?: string;
  contractNumber: string;
  title: string;
  templateType: string;
  content: string;
  terms?: any;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateContractData {
  title?: string;
  templateType?: string;
  content?: string;
  terms?: any;
  startDate?: Date;
  endDate?: Date;
}

export interface StatusUpdateData {
  sentAt?: Date;
  signedAt?: Date;
  signatureUrl?: string;
  pdfUrl?: string;
}

export interface ContractWithDetails extends Contract {
  client: any;
  proposal?: any;
}

/**
 * Check if contract exists and belongs to user
 */
async function existsForUser(id: string, userId: string): Promise<boolean> {
  const contract = await prisma.contract.findFirst({
    where: {
      id,
      userId,
    },
  });
  return contract !== null;
}

/**
 * Find contract by ID (only if belongs to user)
 */
async function findById(
  id: string,
  userId: string,
): Promise<ContractWithDetails | null> {
  return prisma.contract.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
      proposal: {
        select: {
          id: true,
          proposalNumber: true,
          title: true,
          totalAmount: true,
        },
      },
    },
  });
}

/**
 * Generate next contract number for user
 */
async function generateContractNumber(userId: string): Promise<string> {
  const lastContract = await prisma.contract.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { contractNumber: true },
  });

  if (!lastContract) {
    return 'CONT-0001';
  }

  // Extract number from format CONT-0001
  const match = lastContract.contractNumber.match(/CONT-(\d+)/);
  if (match) {
    const nextNumber = parseInt(match[1], 10) + 1;
    return `CONT-${nextNumber.toString().padStart(4, '0')}`;
  }

  return 'CONT-0001';
}

/**
 * Create new contract
 */
async function create(data: CreateContractData): Promise<ContractWithDetails> {
  return prisma.contract.create({
    data: {
      userId: data.userId,
      clientId: data.clientId,
      proposalId: data.proposalId,
      contractNumber: data.contractNumber,
      title: data.title,
      templateType: data.templateType,
      content: data.content,
      terms: data.terms ?? Prisma.JsonNull,
      startDate: data.startDate,
      endDate: data.endDate,
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
      proposal: {
        select: {
          id: true,
          proposalNumber: true,
          title: true,
          totalAmount: true,
        },
      },
    },
  });
}

/**
 * Update contract
 */
async function update(
  id: string,
  userId: string,
  data: UpdateContractData,
): Promise<ContractWithDetails> {
  return prisma.contract.update({
    where: {
      id,
      userId,
    },
    data: {
      ...data,
      terms:
        data.terms !== undefined ? data.terms ?? Prisma.JsonNull : undefined,
      updatedAt: new Date(),
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
      proposal: {
        select: {
          id: true,
          proposalNumber: true,
          title: true,
          totalAmount: true,
        },
      },
    },
  });
}

/**
 * Update contract status
 */
async function updateStatus(
  id: string,
  userId: string,
  status: ContractStatus,
  additionalData?: StatusUpdateData,
): Promise<Contract> {
  return prisma.contract.update({
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
 * Delete contract (hard delete)
 */
async function remove(id: string, userId: string): Promise<Contract> {
  return prisma.contract.delete({
    where: {
      id,
      userId,
    },
  });
}

/**
 * Get all contracts for a user with pagination
 */
async function findAllByUser(
  userId: string,
  skip: number = 0,
  take: number = 20,
  status?: ContractStatus,
  search?: string,
): Promise<ContractWithDetails[]> {
  const where: Prisma.ContractWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { contractNumber: { contains: search, mode: 'insensitive' } },
      {
        client: {
          companyName: { contains: search, mode: 'insensitive' },
        },
      },
    ];
  }

  return prisma.contract.findMany({
    where,
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
        },
      },
      proposal: {
        select: {
          id: true,
          proposalNumber: true,
          title: true,
          totalAmount: true,
        },
      },
    },
  });
}

/**
 * Count contracts for a user
 */
async function countByUser(
  userId: string,
  status?: ContractStatus,
  search?: string,
): Promise<number> {
  const where: Prisma.ContractWhereInput = {
    userId,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { contractNumber: { contains: search, mode: 'insensitive' } },
      {
        client: {
          companyName: { contains: search, mode: 'insensitive' },
        },
      },
    ];
  }

  return prisma.contract.count({ where });
}

/**
 * Mark contract as sent
 */
async function markAsSent(id: string, userId: string): Promise<Contract> {
  return prisma.contract.update({
    where: {
      id,
      userId,
    },
    data: {
      status: ContractStatus.SENT,
      updatedAt: new Date(),
    },
  });
}

/**
 * Mark contract as signed
 */
async function markAsSigned(
  id: string,
  userId: string,
  signatureUrl?: string,
): Promise<Contract> {
  return prisma.contract.update({
    where: {
      id,
      userId,
    },
    data: {
      status: ContractStatus.SIGNED,
      signedAt: new Date(),
      signatureUrl: signatureUrl,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create contract from proposal
 */
async function createFromProposal(
  proposalId: string,
  userId: string,
  templateType: string,
  content: string,
): Promise<ContractWithDetails> {
  // Get proposal details
  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      userId,
    },
    include: {
      client: true,
    },
  });

  if (!proposal) {
    throw new Error('Proposal not found');
  }

  // Generate contract number
  const contractNumber = await generateContractNumber(userId);

  return create({
    userId,
    clientId: proposal.clientId,
    proposalId: proposal.id,
    contractNumber,
    title: proposal.title,
    templateType,
    content,
    terms: {
      amount: proposal.totalAmount,
      currency: proposal.currency,
      scope: proposal.scope,
      deliverables: proposal.deliverables,
      timeline: proposal.timeline,
    },
  });
}

export default {
  existsForUser,
  findById,
  generateContractNumber,
  create,
  update,
  updateStatus,
  remove,
  findAllByUser,
  countByUser,
  markAsSent,
  markAsSigned,
  createFromProposal,
};
