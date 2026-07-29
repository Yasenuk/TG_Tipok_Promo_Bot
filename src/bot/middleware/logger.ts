import type { MiddlewareFn } from 'telegraf';
import type { AppContext } from '../context.js';
import { logger } from '../../infra/logger.js';

export const loggerMiddleware: MiddlewareFn<AppContext> = async (ctx, next) => {
  const start = Date.now();

  ctx.log = logger.child({
    updateId: ctx.update.update_id,
    tgId: ctx.from?.id,
    updateType: ctx.updateType,
  });

  ctx.log.debug('update ⇢');

  await next();

  ctx.log.debug({ ms: Date.now() - start }, 'update ⇠');
};
