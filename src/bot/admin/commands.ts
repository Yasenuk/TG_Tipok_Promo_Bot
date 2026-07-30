import { Composer } from 'telegraf';
import type { AppContext } from '../context.js';
import { campaignRepo } from '../../db/repositories/campaign.repo.js';
import { codeRepo } from '../../db/repositories/code.repo.js';
import { prisma } from '../../db/client.js';
import { isAdmin, isSuperAdmin } from './guard.js';
import { contentRepo } from '../../db/repositories/content.repo.js';
import { invalidateContentCache } from '../../domain/content/content.service.js';
import type { ContentKey } from '../../domain/content/keys.js';

export const adminCommands = new Composer<AppContext>();

/**
 * Показати ID групи
 */
adminCommands.command('chatid', async (ctx) => {
  const chat = ctx.chat;
  const threadId = 'message_thread_id' in ctx.message ? ctx.message.message_thread_id : undefined;
  const isForum = 'is_forum' in chat ? chat.is_forum : false;

  const lines = [
    `<b>Chat ID:</b> <code>${chat.id}</code>`,
    `<b>Тип:</b> ${chat.type}${isForum ? ' (форум ✅)' : ''}`,
  ];

  if (threadId) {
    lines.push(`<b>Thread ID:</b> <code>${threadId}</code>`);
  } else if (chat.type !== 'private') {
    lines.push('<i>Це General або топіки вимкнені</i>');
  }

  lines.push('', `<b>Твій ID:</b> <code>${ctx.from.id}</code>`);

  if (chat.type === 'supergroup' && !isForum) {
    lines.push('', '⚠️ Топіки вимкнені. Увімкни їх у налаштуваннях групи.');
  }
  if (chat.type === 'group') {
    lines.push(
      '',
      '⚠️ Це звичайна група, топіки тут недоступні.',
      'Увімкни Topics у налаштуваннях — Telegram сам конвертує її в супергрупу,',
      'і chat_id ЗМІНИТЬСЯ. Виконай /chatid ще раз після конвертації.',
    );
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
});

/**
 * Прив'язка топіка до кампанії
 *
 * Виконується ВСЕРЕДИНІ потрібного топіка адмін-групи — бот бере
 * message_thread_id прямо з повідомлення
 */
adminCommands.command('bind_topic', async (ctx) => {
  if (!(await isSuperAdmin(ctx.from.id))) return;

  const slug = ctx.message.text.split(/\s+/)[1];
  if (!slug) {
    await ctx.reply('Використання: /bind_topic <slug-кампанії>');
    return;
  }

  const threadId = ctx.message.message_thread_id;
  if (!threadId) {
    await ctx.reply(
      'Виконай цю команду всередині топіка кампанії.\n' +
        'Якщо топіків немає — увімкни їх у налаштуваннях групи (Topics).',
    );
    return;
  }

  const campaign = await campaignRepo.findBySlug(slug);
  if (!campaign) {
    await ctx.reply(`Кампанію «${slug}» не знайдено.`);
    return;
  }

  await campaignRepo.bindAdminThread(slug, threadId);
  await ctx.reply(`✅ Топік прив'язано до кампанії «${campaign.title}».`);
});

adminCommands.command('campaigns', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const campaigns = await campaignRepo.listAll();
  if (campaigns.length === 0) {
    await ctx.reply('Кампаній ще немає.');
    return;
  }

  const lines = campaigns.map(
    (c) =>
      `${c.status === 'ACTIVE' ? '🟢' : '⚪️'} ${c.slug} — ${c.title}` +
      `${c.adminThreadId ? '' : '  ⚠️ топік не прив’язано'}`,
  );

  await ctx.reply(lines.join('\n'));
});

adminCommands.command('stats', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;

  const slug = ctx.message.text.split(/\s+/)[1];
  const campaign = slug ? await campaignRepo.findBySlug(slug) : undefined;

  if (slug && !campaign) {
    await ctx.reply(`Кампанію «${slug}» не знайдено.`);
    return;
  }

  const where = campaign ? { campaignId: campaign.id } : {};

  const [participants, activations, claims, codeStats] = await Promise.all([
    prisma.participation.count({ where }),
    prisma.activation.count({ where }),
    prisma.prizeClaim.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    campaign ? codeRepo.countByCampaign(campaign.id) : Promise.resolve([]),
  ]);

  const used = codeStats.find((r) => r.isUsed)?._count._all ?? 0;
  const free = codeStats.find((r) => !r.isUsed)?._count._all ?? 0;

  const lines = [
    `📊 ${campaign ? campaign.title : 'Усі кампанії'}`,
    '',
    `👥 Учасників: ${participants}`,
    `🎟 Активацій: ${activations}`,
    ...(campaign ? [`🔢 Кодів: ${used} використано / ${free} вільно`] : []),
    '',
    '🎁 Заявки:',
    ...claims.map((c) => `   ${c.status}: ${c._count._all}`),
  ];

  await ctx.reply(lines.join('\n'));
});

/** Редагування текстів без деплою */
adminCommands.command('text', async (ctx) => {
  if (!(await isSuperAdmin(ctx.from.id))) return;

  const [, sub, ...rest] = ctx.message.text.split(/\s+/);

  if (sub === 'list') {
    const rows = await contentRepo.listKeys(null);
    const lines = rows.map((r) => `${r.key} = ${r.value.slice(0, 40)}…`);
    await ctx.reply(lines.join('\n') || 'У БД перевизначень немає.');
    return;
  }

  if (sub === 'set') {
    const key = rest[0];
    const value = ctx.message.text.split(/\s+/).slice(3).join(' ');

    if (!key || !value) {
      await ctx.reply('Використання: /text set <ключ> <текст>');
      return;
    }

    await contentRepo.set(key, value, null, 'uk', BigInt(ctx.from.id));
    invalidateContentCache(key as ContentKey);
    await ctx.reply(`✅ Оновлено «${key}».`);
    return;
  }

  await ctx.reply('Використання:\n/text list\n/text set <ключ> <текст>');
});
