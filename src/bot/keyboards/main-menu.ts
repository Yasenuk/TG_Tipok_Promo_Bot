import { Markup } from 'telegraf';
import { contentService } from '../../domain/content/content.service.js';

/** Постійна клавіатура під полем вводу */
export async function mainMenuKeyboard() {
  const [enterCode, myProgress, myPrizes, rules] = await Promise.all([
    contentService.t('button.enter_code'),
    contentService.t('button.my_progress'),
    contentService.t('button.my_prizes'),
    contentService.t('button.rules'),
  ]);

  return Markup.keyboard([
    [enterCode],
    [myProgress, myPrizes],
    [rules],
  ]).resize();
}

export async function phoneRequestKeyboard() {
  const share = await contentService.t('button.share_phone');
  return Markup.keyboard([[Markup.button.contactRequest(share)]])
    .resize()
    .oneTime();
}

export async function consentKeyboard() {
  const agree = await contentService.t('button.consent_agree');
  return Markup.inlineKeyboard([
    [Markup.button.callback(agree, 'consent:agree')],
  ]);
}
