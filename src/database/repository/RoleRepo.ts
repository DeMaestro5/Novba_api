import prisma from '../index';
import { Role } from '@prisma/client';

async function findByCode(code: string): Promise<Role | null> {
  return await prisma.role.findFirst({
    where: {
      code: code,
      status: true,
    },
  });
}

async function findByCodes(codes: string[]): Promise<Role[]> {
  return await prisma.role.findMany({
    where: {
      code: { in: codes },
      status: true,
    },
  });
}

export default {
  findByCode,
  findByCodes,
};
