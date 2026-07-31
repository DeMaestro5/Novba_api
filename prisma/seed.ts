import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Roles upsert so re-running never duplicates
  for (const code of ['USER', 'ADMIN']) {
    await prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, status: true },
    });
  }

  //Api key
  const apiKey =
    process.env.SEED_API_KEY ??
    '249f676ebc7ae9aa224c5da202f3342d8547be8685cbfd61c6fd14298e533300';
  await prisma.apiKey.upsert({
    where: { key: apiKey },
    update: {},
    create: { key: apiKey, version: 1, permissions: ['GENERAL'], status: true },
  });

  console.log('Seed complete: roles + api key');
}
main().finally(() => prisma.$disconnect());
