import { Markup, Scenes } from 'telegraf';
import { message } from 'telegraf/filters';
import type { AppContext } from '../context.js';
import { codeService } from '../../domain/codes/code.service.js';
import { contentService } from '../../domain/content/content.service.js';
import { encodeCallback } from '../keyboards/callback.js';
import { mainMenuKeyboard } from '../keyboards/main-menu.js';
import type { CodeError } from '../../shared/errors.js';

export const CODE_ENTRY_SCENE = 'code-entry';

export const codeEntryScene = new Scenes.BaseScene<AppContext>(CODE_ENTRY_SCENE);

codeEntryScene.enter(async (ctx) => {
  const cancel = await contentService.t('button.cancel');
  await ctx.reply_t(
    'code.ask',
    undefined,
    Markup.keyboard([[cancel]]).resize().oneTime(),
  );
});

codeEntryScene.on(message('text'), async (ctx) => {
  const text = ctx.message.text.trim();

  const cancel = await contentService.t('button.cancel');
  if (text === cancel || text === '/cancel') {
    await ctx.reply_t('menu.title', undefined, await mainMenuKeyboard());
    await ctx.scene.leave();
    return;
  }

  const result = await codeService.activate(
    text,
    ctx.user.id,
    BigInt(ctx.from.id),
  );

  if (!result.ok) {
    await replyCodeError(ctx, result.error);
    return; // лишаємось у сцені
  }

  const { campaign, activationCount, claims, outOfStock } = result.value;

  await ctx.reply_t(
    'code.accepted',
    { campaign: campaign.title, count: activationCount },
    await mainMenuKeyboard(),
  );

  for (const _missed of outOfStock) {
    await ctx.reply_t('prize.out_of_stock');
  }

  const chooseStore = await contentService.t('button.choose_store');

  for (const claim of claims) {
    const text = await contentService.t(
      'prize.won',
      { prize: claim.prizeTitle },
      { campaignId: campaign.id },
    );

    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            chooseStore,
            encodeCallback({ kind: 'chooseStore', claimId: claim.id }),
          ),
        ],
      ]),
    );
  }

  await ctx.scene.leave();
});

codeEntryScene.on('message', async (ctx) => {
  await ctx.reply_t('code.ask');
});

async function replyCodeError(ctx: AppContext, error: CodeError): Promise<void> {
  switch (error.type) {
    case 'code.used_by_you':
      await ctx.reply_t('code.used_by_you', {
        date: error.usedAt.toLocaleDateString('uk-UA'),
      });
      return;

    case 'code.rate_limited':
      await ctx.reply_t('code.rate_limited', { seconds: error.retryAfterSec });
      await ctx.scene.leave();
      return;

    case 'code.campaign_inactive':
      await ctx.reply_t('code.campaign_inactive', { campaign: error.campaignTitle });
      return;

    case 'code.campaign_not_started':
      await ctx.reply_t('code.campaign_not_started', {
        date: error.startsAt.toLocaleDateString('uk-UA'),
      });
      return;

    case 'code.campaign_ended':
      await ctx.reply_t('code.campaign_ended');
      return;

    case 'code.not_found':
      await ctx.reply_t('code.not_found');
      return;

    case 'code.already_used':
      await ctx.reply_t('code.already_used');
      return;
  }
}
