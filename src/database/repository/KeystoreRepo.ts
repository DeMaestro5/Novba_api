import prisma from '../index';
import { Keystore } from '@prisma/client';

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

async function remove(id: string): Promise<Keystore | null> {
  return prisma.keystore.delete({
    where: { id },
  });
}

async function removeAllForClient(userId: string): Promise<{ count: number }> {
  return prisma.keystore.deleteMany({
    where: { userId },
  });
}

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
    },
  });
}

async function create(
  userId: string,
  primaryKey: string,
  secondaryKey: string,
): Promise<Keystore> {
  // Prisma handles createdAt/updatedAt automatically!
  return prisma.keystore.create({
    data: {
      userId, // ✅ Much simpler!
      primaryKey,
      secondaryKey,
    },
  });
}

export default {
  findForKey,
  remove,
  removeAllForClient,
  find,
  create,
};
