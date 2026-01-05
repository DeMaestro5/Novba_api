import { PrismaClient } from '@prisma/client';
import { RoleCode } from '../database/types';

const prisma = new PrismaClient();

const API_KEY_VALUE =
  '249f676ebc7ae9aa224c5da202f3342d8547be8685cbfd61c6fd14298e533300';

async function main() {
  console.log('🌱 Starting API Key seed...');

  try {
    // Check connection
    await prisma.$connect();
    console.log('✅ Connected to database');

    // Upsert API key
    const apiKey = await prisma.apiKey.upsert({
      where: { key: API_KEY_VALUE },
      update: {},
      create: {
        key: API_KEY_VALUE,
        version: 1,
        permissions: ['GENERAL'],
        comments: ['Default development API Key'],
        status: true,
      },
    });

    // upsert roles

    const userRole = await prisma.role.upsert({
      where: { code: RoleCode.USER },
      update: {},
      create: {
        code: RoleCode.USER,
        status: true,
      },
    });
    const adminRole = await prisma.role.upsert({
      where: { code: RoleCode.ADMIN },
      update: {},
      create: {
        code: RoleCode.ADMIN,
        status: true,
      },
    });

    console.log('✅ API Key seeded successfully!');
    console.log({
      id: apiKey.id,
      key: apiKey.key,
      permissions: apiKey.permissions,
      status: apiKey.status,
    });
    console.log({
      id: userRole.id,
      code: userRole.code,
      status: userRole.status,
    });
    console.log({
      id: adminRole.id,
      code: adminRole.code,
      status: adminRole.status,
    });
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
