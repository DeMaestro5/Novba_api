import prisma from '../index';
import { Role } from '@prisma/client';

/**
 * Find role by code
 * Uses findUnique since code is unique in schema
 */
async function findByCode(code: string): Promise<Role | null> {
  return prisma.role.findUnique({
    where: {
      code: code,
    },
  });
}

/**
 * Find multiple roles by codes
 */
async function findByCodes(codes: string[]): Promise<Role[]> {
  return prisma.role.findMany({
    where: {
      code: { in: codes },
      status: true,
    },
  });
}

/**
 * Create a new role
 */
async function create(code: string): Promise<Role> {
  return prisma.role.create({
    data: {
      code,
    },
  });
}

/**
 * Get all active roles
 */
async function findAll(): Promise<Role[]> {
  return prisma.role.findMany({
    where: {
      status: true,
    },
    orderBy: {
      code: 'asc',
    },
  });
}

/**
 * Check if role exists
 */
async function exists(code: string): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: {
      code,
    },
  });
  return role !== null && role.status === true;
}

export default {
  findByCode,
  findByCodes,
  create,
  findAll,
  exists,
};
