import { session } from 'telegraf';
import type { MiddlewareFn } from 'telegraf';
import type { AppContext, AppSession } from '../context.js';
import { userRepo } from '../../db/repositories/user.repo.js';
import { logger } from '../../infra/logger.js';

/**
 * Сховище сесій у Prisma (поле User.state)
 */
const prismaSessionStore = {
  async get(key: string): Promise<AppSession | undefined> {
    try {
      const state = await userRepo.getState(BigInt(key));
      return (state as AppSession | undefined) ?? undefined;
    } catch (error) {
      logger.error({ error, key }, 'Не вдалося прочитати сесію');
      return undefined;
    }
  },

  async set(key: string, value: AppSession): Promise<void> {
    try {
      await userRepo.setState(BigInt(key), value as never);
    } catch (error) {
      logger.error({ error, key }, 'Не вдалося зберегти сесію');
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await userRepo.clearState(BigInt(key));
    } catch (error) {
      logger.error({ error, key }, 'Не вдалося очистити сесію');
    }
  },
};

export const sessionMiddleware: MiddlewareFn<AppContext> = session({
  store: prismaSessionStore,
  getSessionKey: (ctx) => (ctx.from ? String(ctx.from.id) : undefined),
  defaultSession: () => ({}) as AppSession,
});
