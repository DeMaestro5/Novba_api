import prisma from '../index';
import { ApiKey } from '@prisma/client';

async function findByKey(key: string): Promise<ApiKey | null> {
  return prisma.apiKey.findUnique({
    where: {
      key: key,
      status: true,
    },
  });
}

export default {
  findByKey,
};
