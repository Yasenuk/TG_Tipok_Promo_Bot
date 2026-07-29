import { Scenes, Telegraf } from 'telegraf';
import type { AppContext } from './context.js';
import { env } from '../config/env.js';
import { logger } from '../infra/logger.js';

import { loggerMiddleware } from './middleware/logger.js';
import { contentMiddleware } from './middleware/content.js';
import { errorHandlerMiddleware } from './middleware/error-handler.js';
import { userMiddleware } from './middleware/user.js';
import { sessionMiddleware } from './middleware/session.js';
import { rateLimitMiddleware, startRateLimitCleanup } from './middleware/rate-limit.js';

import { registrationScene } from './scenes/registration.scene.js';
import { startHandler } from './handlers/start.handler.js';
import { menuHandler } from './handlers/menu.handler.js';

export function createBot(): Telegraf<AppContext> {
  const bot = new Telegraf<AppContext>(env.BOT_TOKEN, {
    handlerTimeout: 30_000,
  });

  bot.use(loggerMiddleware);
  bot.use(contentMiddleware);
  bot.use(errorHandlerMiddleware);
  bot.use(userMiddleware);
  bot.use(sessionMiddleware);
  bot.use(rateLimitMiddleware);

  const stage = new Scenes.Stage<AppContext>([registrationScene]);
  bot.use(stage.middleware());

  bot.use(startHandler);
  bot.use(menuHandler);

  // Невідомий текст поза сценами
  bot.on('message', async (ctx) => {
    await ctx.reply_t('error.unknown_command');
  });

  // Помилки, що прорвались поза errorHandlerMiddleware
  bot.catch((error, ctx) => {
    logger.error({ error, updateId: ctx.update.update_id }, 'bot.catch');
  });

  startRateLimitCleanup();

  return bot;
}

export async function launchBot(bot: Telegraf<AppContext>): Promise<void> {
  const me = await bot.telegram.getMe();
  logger.info({ username: me.username, id: me.id }, 'Бот автентифікований');

  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Почати' },
    { command: 'cancel', description: 'Скасувати поточну дію' },
  ]);

  void bot.launch({ dropPendingUpdates: true }, () => {
    logger.info('Long polling запущено');
  });
}
