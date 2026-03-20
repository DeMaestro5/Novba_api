import prisma from '../index';
import { Keystore } from '@prisma/client';

/**
 * Find keystore by userId and primaryKey
 */
async function findForKey(
  userId: string,
  key: string,
): Promise<Keystore | null> {
  return prisma.keystore.findFirst({
    where: {
      userId,
      primaryKey: key,
      status: true,
    },
  });
}

/**
 * Find keystore by userId, primaryKey, and secondaryKey
 */
async function find(
  userId: string,
  primaryKey: string,
  secondaryKey: string,
): Promise<Keystore | null> {
  return prisma.keystore.findFirst({
    where: {
      userId,
      primaryKey,
      secondaryKey,
      status: true,
    },
  });
}

/**
 * Create new keystore entry
 */
async function create(
  userId: string,
  primaryKey: string,
  secondaryKey: string,
): Promise<Keystore> {
  return prisma.keystore.create({
    data: {
      userId,
      primaryKey,
      secondaryKey,
    },
  });
}

/**
 * Remove a specific keystore by ID
 */
async function remove(id: string): Promise<Keystore> {
  return prisma.keystore.delete({
    where: { id },
  });
}

/**
 * Remove all keystores for a user (e.g., logout all devices)
 */
async function removeAllForClient(userId: string): Promise<{ count: number }> {
  return prisma.keystore.deleteMany({
    where: { userId },
  });
}

/**
 * Soft delete keystore (set status to false)
 */
async function deactivate(id: string): Promise<Keystore> {
  return prisma.keystore.update({
    where: { id },
    data: {
      status: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get all active keystores for a user
 */
async function findAllForUser(userId: string): Promise<Keystore[]> {
  return prisma.keystore.findMany({
    where: {
      userId,
      status: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Clean up old keystores (older than X days)
 */
async function removeOlderThan(days: number): Promise<{ count: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return prisma.keystore.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });
}

async function deleteAllForUser(userId: string): Promise<void> {
  await prisma.keystore.deleteMany({ where: { userId } });
}

async function findForSecondaryKey(
  userId: string,
  secondaryKey: string,
): Promise<Keystore | null> {
  return prisma.keystore.findFirst({
    where: {
      userId,
      secondaryKey,
      status: true,
    },
  });
}

export default {
  findForSecondaryKey,
  findForKey,
  find,
  create,
  remove,
  removeAllForClient,
  deactivate,
  findAllForUser,
  removeOlderThan,
  deleteAllForUser,
};
