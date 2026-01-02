import { PrismaClient } from '@prisma/client';
import Logger from '../core/Logger';

// Create a new Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  errorFormat: 'pretty',
});

// Log the Prisma client connection
prisma
  .$connect()
  .then(() => {
    Logger.info('Prisma client connected');
  })
  .catch((error: Error) => {
    Logger.error('Prisma client connection error', error);
    process.exit(1);
  });

//Gracefully shutdown the Prisma client
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  Logger.info('Prisma client disconnected');
  process.exit(0);
});

export default prisma;
