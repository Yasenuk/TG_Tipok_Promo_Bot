import { env } from './config/env.js';
import { logger } from './infra/logger.js';
import { connectWithRetry, disconnect } from './db/client.js';
import { createBot, launchBot } from './bot/index.js';

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV }, 'Стартуємо');

  await connectWithRetry();

  const bot = createBot();
  await launchBot(bot);

  logger.info('Бот працює');

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    void (async () => {
      logger.info({ signal }, 'Завершуємось');
      try {
        bot.stop(signal);
      } catch {
        
      }
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
