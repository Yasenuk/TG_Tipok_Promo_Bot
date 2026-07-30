import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env, isDev } from '../config/env.js';
import { logger } from '../infra/logger.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 30_000,
  max: 10,
  keepAlive: true,
});

export const prisma = new PrismaClient({
  adapter,
  log: isDev ? ['warn', 'error'] : ['error'],
});

export async function connectWithRetry(attempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (attempt > 1) logger.info({ attempt }, 'База відповіла');
      return;
    } catch (error) {
      if (attempt === attempts) {
        logger.fatal(
          { error },
          'База недоступна',
        );
        throw error;
      }

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
      logger.warn({ attempt, delayMs }, 'База не відповідає');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}