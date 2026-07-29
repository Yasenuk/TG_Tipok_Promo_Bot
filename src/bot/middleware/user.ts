import type { MiddlewareFn } from 'telegraf';
import type { AppContext } from '../context.js';
import { userRepo } from '../../db/repositories/user.repo.js';

/**
 * Створює або освіжає юзера при кожному апдейті
 */
export const userMiddleware: MiddlewareFn<AppContext> = async (ctx, next) => {
  if (!ctx.from) {
    return;
  }

  if (ctx.from.is_bot) {
    ctx.log?.debug('апдейт від бота');
    return;
  }

  ctx.user = await userRepo.upsertFromTelegram({
    telegramId: BigInt(ctx.from.id),
    username: ctx.from.username,
  });

  await next();
};
