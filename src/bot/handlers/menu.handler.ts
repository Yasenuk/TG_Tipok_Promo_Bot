import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import type { AppContext } from '../context.js';
import { userRepo } from '../../db/repositories/user.repo.js';
import { contentService } from '../../domain/content/content.service.js';
import { REGISTRATION_SCENE } from '../scenes/registration.scene.js';
import { CODE_ENTRY_SCENE } from '../scenes/code-entry.scene.js';
import { showMyPrizes, showMyProgress } from './prize.handler.js';

export const menuHandler = new Composer<AppContext>();

menuHandler.on(message('text'), async (ctx, next) => {
  const text = ctx.message.text.trim();

  const [enterCode, myProgress, myPrizes, rules] = await Promise.all([
    contentService.t('button.enter_code'),
    contentService.t('button.my_progress'),
    contentService.t('button.my_prizes'),
    contentService.t('button.rules'),
  ]);

  const isMenuButton = [enterCode, myProgress, myPrizes, rules].includes(text);
  if (!isMenuButton) return next();

  // Незареєстрованих на будь-яку кнопку відправляємо реєструватись
  if (!userRepo.isRegistered(ctx.user)) {
    await ctx.scene.enter(REGISTRATION_SCENE);
    return;
  }

  switch (text) {
    case enterCode:
      await ctx.scene.enter(CODE_ENTRY_SCENE);
      return;

    case myProgress:
      await showMyProgress(ctx);
      return;

    case myPrizes:
      await showMyPrizes(ctx);
      return;

    case rules:
      await ctx.reply_t('welcome');
      return;

    default:
      return next();
  }
});
