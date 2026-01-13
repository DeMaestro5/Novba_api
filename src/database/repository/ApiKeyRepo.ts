import prisma from '../index';
import { ApiKey } from '@prisma/client';

/**
 * Find API key by key string
 * Uses findFirst because we need to check both key AND status
 */
async function findByKey(key: string): Promise<ApiKey | null> {
  return prisma.apiKey.findFirst({
    where: {
      key: key,
      status: true,
    },
  });
}

/**
 * Create a new API key
 */
async function create(
  key: string,
  version: number,
  permissions: string[] = [],
  comments: string[] = [],
): Promise<ApiKey> {
  return prisma.apiKey.create({
    data: {
      key,
      version,
      permissions,
      comments,
    },
  });
}

/**
 * Update API key permissions
 */
async function updatePermissions(
  key: string,
  permissions: string[],
): Promise<ApiKey> {
  return prisma.apiKey.update({
    where: { key },
    data: {
      permissions,
      updatedAt: new Date(),
    },
  });
}

/**
 * Deactivate API key
 */
async function deactivate(key: string): Promise<ApiKey> {
  return prisma.apiKey.update({
    where: { key },
    data: {
      status: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get all active API keys
 */
async function findAllActive(): Promise<ApiKey[]> {
  return prisma.apiKey.findMany({
    where: {
      status: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export default {
  findByKey,
  create,
  updatePermissions,
  deactivate,
  findAllActive,
};
