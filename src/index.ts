import { env } from './config/env.js';
import { logger } from './infra/logger.js';
import { connectWithRetry, disconnect } from './db/client.js';

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, 'Стартуємо');

  await connectWithRetry();

  logger.info('Ядро живе');

  const shutdown = (signal: string) => {
    void (async () => {
      logger.info({ signal }, 'Завершуємось');
      await disconnect();
      process.exit(0);
    })();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ error }, 'Не вдалося стартувати');
  process.exit(1);
});
