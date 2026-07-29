import { Composer } from 'telegraf';
import type { AppContext } from '../context.js';
import { userRepo } from '../../db/repositories/user.repo.js';
import { REGISTRATION_SCENE } from '../scenes/registration.scene.js';
import { mainMenuKeyboard } from '../keyboards/main-menu.js';

export const startHandler = new Composer<AppContext>();

startHandler.start(async (ctx) => {
  await ctx.scene.leave().catch(() => undefined);

  if (!userRepo.isRegistered(ctx.user)) {
    await ctx.scene.enter(REGISTRATION_SCENE);
    return;
  }

  const firstName = ctx.user.fullName?.split(' ')[1] ?? '';
  await ctx.reply_t('welcome.back', { name: firstName }, await mainMenuKeyboard());
});
